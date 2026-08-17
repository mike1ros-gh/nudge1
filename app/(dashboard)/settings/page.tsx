"use client";

import { useEffect, useState } from "react";
import type { AccountOption } from "@/components/account-select";
import { formatGmtLabel } from "@/lib/utils/timezone";
import { classifyTokenExpiry } from "@/lib/token-expiry";

type InstagramAccount = AccountOption & {
  tokenExpiresAt: string | null;
  webhookSubscribed: boolean;
};

interface SettingsData {
  workspace: {
    name: string;
    dmsSentThisPeriod: number;
    utcOffsetMinutes: number;
    alertsEnabled: boolean;
  };
}

// Whole-hour GMT offsets from -12 to +14, the practical range of
// real-world UTC offsets — a short list instead of ~400 IANA city names.
const GMT_OFFSETS: number[] = Array.from({ length: 27 }, (_, i) => (i - 12) * 60);

interface WorkspaceMembersData {
  currentUserRole: "OWNER" | "ADMIN" | "MEMBER";
  members: Array<{
    id: string;
    role: "OWNER" | "ADMIN" | "MEMBER";
    createdAt: string;
    user: {
      id: string;
      email: string | null;
      name: string | null;
    };
  }>;
  invitations: Array<{
    id: string;
    email: string;
    role: "OWNER" | "ADMIN" | "MEMBER";
    inviteUrl: string;
    expiresAt: string;
  }>;
}

const TABS = [
  { id: "general", label: "General" },
  { id: "accounts", label: "Accounts" },
  { id: "team", label: "Team" },
  { id: "usage", label: "Usage" },
] as const;
type TabId = (typeof TABS)[number]["id"];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabId>("general");
  // Captured once at mount rather than read live during render, per the
  // React purity rule against calling Date.now() in a component body.
  const [now] = useState(() => Date.now());

  // Pick up ?tab= on first load (e.g. linked from the sidebar) without
  // pulling in useSearchParams / a Suspense boundary for a one-time read.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const tab = new URLSearchParams(window.location.search).get("tab");
      if (TABS.some((t) => t.id === tab)) setActiveTab(tab as TabId);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  function selectTab(tab: TabId) {
    setActiveTab(tab);
    window.history.replaceState(null, "", `/settings?tab=${tab}`);
  }

  // Accounts
  const [accounts, setAccounts] = useState<InstagramAccount[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [busyAccount, setBusyAccount] = useState<string | null>(null);

  // Team
  const [membersData, setMembersData] = useState<WorkspaceMembersData | null>(
    null
  );
  const [membersLoading, setMembersLoading] = useState(true);
  const [busyInvite, setBusyInvite] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"ADMIN" | "MEMBER">("MEMBER");
  const [memberError, setMemberError] = useState<string | null>(null);

  // Usage / General
  const [data, setData] = useState<SettingsData | null>(null);
  const [usageLoading, setUsageLoading] = useState(true);
  const [timezoneSaving, setTimezoneSaving] = useState(false);
  const [timezoneSaved, setTimezoneSaved] = useState(false);
  const [timezoneError, setTimezoneError] = useState<string | null>(null);

  const [nameInput, setNameInput] = useState("");
  const [nameSaving, setNameSaving] = useState(false);
  const [nameSaved, setNameSaved] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  const [alertsSaving, setAlertsSaving] = useState(false);
  const [alertsError, setAlertsError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/instagram/accounts")
      .then((res) => res.json())
      .then((payload) => {
        if (payload.success) setAccounts(payload.data.instagramAccounts);
      })
      .finally(() => setAccountsLoading(false));

    fetch("/api/workspace/members")
      .then((res) => res.json())
      .then((payload) => {
        if (payload.success) setMembersData(payload.data);
      })
      .finally(() => setMembersLoading(false));

    fetch("/api/dashboard/stats")
      .then((res) => res.json())
      .then((payload) => {
        if (payload.success) {
          setData(payload.data);
          setNameInput(payload.data.workspace.name);
        }
      })
      .finally(() => setUsageLoading(false));
  }, []);

  async function updateTimezone(utcOffsetMinutes: number) {
    if (!data) return;
    setTimezoneSaving(true);
    setTimezoneSaved(false);
    setTimezoneError(null);
    const res = await fetch("/api/workspace/timezone", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ utcOffsetMinutes }),
    });
    const payload = await res.json();
    if (payload.success) {
      setData({ ...data, workspace: { ...data.workspace, utcOffsetMinutes } });
      setTimezoneSaved(true);
    } else {
      setTimezoneError(payload.error ?? "Could not update timezone");
    }
    setTimezoneSaving(false);
  }

  async function updateWorkspaceName(event: React.FormEvent) {
    event.preventDefault();
    if (!data) return;
    setNameSaving(true);
    setNameSaved(false);
    setNameError(null);
    const res = await fetch("/api/workspace/name", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: nameInput }),
    });
    const payload = await res.json();
    if (payload.success) {
      setData({ ...data, workspace: { ...data.workspace, name: payload.data.name } });
      setNameInput(payload.data.name);
      setNameSaved(true);
    } else {
      setNameError(payload.error ?? "Could not update name");
    }
    setNameSaving(false);
  }

  async function updateAlertsEnabled(alertsEnabled: boolean) {
    if (!data) return;
    setAlertsSaving(true);
    setAlertsError(null);
    const res = await fetch("/api/workspace/alerts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ alertsEnabled }),
    });
    const payload = await res.json();
    if (payload.success) {
      setData({ ...data, workspace: { ...data.workspace, alertsEnabled } });
    } else {
      setAlertsError(payload.error ?? "Could not update alert settings");
    }
    setAlertsSaving(false);
  }

  async function disconnectInstagram(instagramAccountId: string) {
    if (
      !confirm(
        "Disconnect Instagram? Campaigns for this account will stop sending DMs."
      )
    ) {
      return;
    }
    setBusyAccount(`disconnect:${instagramAccountId}`);
    await fetch("/api/instagram/disconnect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ instagramAccountId }),
    });
    window.location.reload();
  }

  async function refreshMembers() {
    const res = await fetch("/api/workspace/members");
    const payload = await res.json();
    if (payload.success) setMembersData(payload.data);
  }

  async function inviteMember(event: React.FormEvent) {
    event.preventDefault();
    setMemberError(null);
    setBusyInvite("invite");
    const res = await fetch("/api/workspace/members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
    });
    const payload = await res.json();
    if (payload.success) {
      setMembersData(payload.data);
      setInviteEmail("");
    } else {
      setMemberError(payload.error ?? "Could not invite member");
    }
    setBusyInvite(null);
  }

  async function removeInvitation(invitationId: string) {
    setBusyInvite(`invite:${invitationId}`);
    await fetch("/api/workspace/members", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invitationId }),
    });
    await refreshMembers();
    setBusyInvite(null);
  }

  const canManageMembers =
    membersData?.currentUserRole === "OWNER" ||
    membersData?.currentUserRole === "ADMIN";

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-bold text-foreground">Settings</h1>

      <div className="mt-6 flex flex-col gap-6 sm:flex-row">
        <nav className="flex shrink-0 gap-1 overflow-x-auto sm:w-40 sm:flex-col sm:overflow-visible">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => selectTab(tab.id)}
              className={`whitespace-nowrap rounded px-3 py-2 text-left text-sm ${
                activeTab === tab.id
                  ? "bg-surface-hover text-foreground font-medium"
                  : "text-muted hover:text-foreground hover:bg-surface-hover"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        <div className="min-w-0 flex-1">
          {activeTab === "general" &&
            (usageLoading ? (
              <div className="panel p-8 h-64" />
            ) : (
              <div className="space-y-6">
              <section className="panel p-6 divide-y divide-border">
                <div className="pb-5">
                  <p className="text-sm font-medium text-foreground">Timezone</p>
                  <p className="text-xs text-muted mt-0.5">
                    Controls day/month boundaries for stats like &quot;DMs sent
                    today&quot; and the daily sends chart.
                  </p>
                  <div className="mt-3 flex items-center gap-3">
                    <select
                      value={data?.workspace.utcOffsetMinutes ?? 480}
                      onChange={(event) => updateTimezone(Number(event.target.value))}
                      disabled={timezoneSaving}
                      className="rounded border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-accent/40 disabled:opacity-50"
                    >
                      {GMT_OFFSETS.map((minutes) => (
                        <option key={minutes} value={minutes}>
                          {formatGmtLabel(minutes)}
                        </option>
                      ))}
                    </select>
                    {timezoneSaving && (
                      <span className="text-xs text-muted">Saving...</span>
                    )}
                    {timezoneSaved && !timezoneSaving && (
                      <span className="text-xs text-success">Saved</span>
                    )}
                  </div>
                  {timezoneError && (
                    <p className="mt-2 text-sm text-error">{timezoneError}</p>
                  )}
                </div>

                <div className="py-5">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        Email me if something needs attention
                      </p>
                      <p className="text-xs text-muted mt-0.5">
                        Once a day, checks worker health, Instagram token
                        expiry, and Redis usage — emails you only if
                        something&apos;s actually wrong.
                      </p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={data?.workspace.alertsEnabled ?? false}
                      onClick={() => updateAlertsEnabled(!data?.workspace.alertsEnabled)}
                      disabled={alertsSaving}
                      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
                        data?.workspace.alertsEnabled ? "bg-accent" : "bg-surface-hover"
                      }`}
                    >
                      <span
                        className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                          data?.workspace.alertsEnabled ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>
                  {alertsError && (
                    <p className="mt-2 text-sm text-error">{alertsError}</p>
                  )}
                </div>

                <div className="pt-5">
                  <p className="text-sm font-medium text-foreground">
                    Export your data
                  </p>
                  <p className="text-xs text-muted mt-0.5">
                    Download every campaign, DM log, and tracked link as an
                    Excel file.
                  </p>
                  <a
                    href="/api/workspace/export"
                    className="mt-3 inline-block rounded border border-border px-4 py-2 text-sm font-medium text-muted transition-colors hover:text-foreground"
                  >
                    Export to Excel
                  </a>
                </div>
              </section>
              </div>
            ))}

          {activeTab === "accounts" &&
            (accountsLoading ? (
              <div className="panel p-8 h-64" />
            ) : (
              <section className="panel p-6">
                <p className="mb-6 text-sm text-muted">
                  Instagram connections that power comment webhooks and
                  private replies.
                </p>
                <div className="space-y-4">
                  <div className="flex items-center justify-between py-3 border-b border-border">
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        Status
                      </p>
                      <p className="text-xs text-muted mt-0.5">
                        Comment webhooks and private replies depend on this
                        connection.
                      </p>
                    </div>
                    <span
                      className={`px-3 py-1.5 rounded-full text-xs font-medium ${
                        accounts.length > 0
                          ? "bg-success/10 text-success"
                          : "bg-warning/10 text-warning"
                      }`}
                    >
                      {accounts.length > 0 ? "Connected" : "Not connected"}
                    </span>
                  </div>

                  <div className="space-y-3 py-3">
                    {accounts.length === 0 && (
                      <p className="text-sm text-muted">
                        Connect an Instagram professional account to launch
                        campaigns.
                      </p>
                    )}
                    {accounts.map((account) => {
                      const expiry = classifyTokenExpiry(account.tokenExpiresAt, now);
                      return (
                      <div
                        key={account.id}
                        className="flex flex-col gap-3 rounded-xl border border-border bg-surface/70 p-4 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div>
                          <p className="text-sm font-semibold text-foreground">
                            @{account.username}
                          </p>
                          <p className="mt-1 text-xs">
                            <span
                              className={
                                expiry.tone === "error"
                                  ? "text-error"
                                  : expiry.tone === "warning"
                                    ? "text-warning"
                                    : "text-muted"
                              }
                            >
                              {expiry.label}
                            </span>
                            <span className="text-muted">
                              {" "}
                              ·{" "}
                              {account.webhookSubscribed
                                ? "Webhook ready"
                                : "Webhook pending"}
                            </span>
                          </p>
                        </div>
                        <button
                          onClick={() => disconnectInstagram(account.id)}
                          disabled={busyAccount === `disconnect:${account.id}`}
                          className="inline-flex items-center justify-center rounded border border-error/20 px-4 py-2 text-sm font-medium text-error hover:border-error/40 hover:bg-error/10 disabled:opacity-50"
                        >
                          {busyAccount === `disconnect:${account.id}`
                            ? "Disconnecting..."
                            : "Disconnect"}
                        </button>
                      </div>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-border flex gap-3">
                  <a
                    href="/api/instagram/connect"
                    className="px-4 py-2 rounded text-sm font-medium bg-accent text-white hover:bg-accent-hover"
                  >
                    {accounts.length > 0
                      ? "Connect another account"
                      : "Connect Instagram"}
                  </a>
                </div>
              </section>
            ))}

          {activeTab === "team" &&
            (membersLoading ? (
              <div className="panel p-8 h-64" />
            ) : (
              <div className="space-y-6">
              <section className="panel p-6">
                <form onSubmit={updateWorkspaceName}>
                  <p className="text-sm font-medium text-foreground">
                    Workspace name
                  </p>
                  <p className="text-xs text-muted mt-0.5">
                    Shown to teammates you invite — not visible to anyone
                    outside your workspace.
                  </p>
                  <div className="mt-3 flex items-center gap-3">
                    <input
                      type="text"
                      value={nameInput}
                      onChange={(event) => setNameInput(event.target.value)}
                      disabled={nameSaving}
                      className="rounded border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-accent/40 disabled:opacity-50"
                    />
                    <button
                      type="submit"
                      disabled={nameSaving || !nameInput.trim() || nameInput === data?.workspace.name}
                      className="rounded bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
                    >
                      {nameSaving ? "Saving..." : "Save"}
                    </button>
                    {nameSaved && !nameSaving && (
                      <span className="text-xs text-success">Saved</span>
                    )}
                  </div>
                  {nameError && (
                    <p className="mt-2 text-sm text-error">{nameError}</p>
                  )}
                </form>
              </section>

              <section className="panel p-6">
                <div className="space-y-3">
                  {membersData?.members.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center justify-between gap-4 border-b border-border py-3 last:border-0"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">
                          {member.user.name ??
                            member.user.email ??
                            "Unknown member"}
                        </p>
                        <p className="text-xs text-muted">
                          {member.user.email}
                        </p>
                      </div>
                      <span className="rounded-full border border-border px-3 py-1 text-xs font-semibold text-muted">
                        {member.role}
                      </span>
                    </div>
                  ))}
                </div>

                {membersData?.invitations.length ? (
                  <div className="mt-6 border-t border-border pt-4">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Pending invites
                    </p>
                    <div className="space-y-3">
                      {membersData.invitations.map((invitation) => (
                        <div
                          key={invitation.id}
                          className="flex flex-col gap-3 rounded border border-border bg-surface/70 p-3 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-foreground">
                              {invitation.email}
                            </p>
                            <p className="truncate text-xs text-muted">
                              {invitation.role} · {invitation.inviteUrl}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                void navigator.clipboard?.writeText(
                                  invitation.inviteUrl
                                )
                              }
                              className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:border-border-hover hover:text-foreground"
                            >
                              Copy
                            </button>
                            <button
                              type="button"
                              onClick={() => removeInvitation(invitation.id)}
                              disabled={
                                busyInvite === `invite:${invitation.id}`
                              }
                              className="rounded-lg border border-error/20 px-3 py-1.5 text-xs font-medium text-error transition-colors hover:bg-error/10 disabled:opacity-50"
                            >
                              Revoke
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {canManageMembers && (
                  <form
                    onSubmit={inviteMember}
                    className="mt-6 grid gap-3 border-t border-border pt-4 sm:grid-cols-[1fr_140px_auto]"
                  >
                    <input
                      type="email"
                      value={inviteEmail}
                      onChange={(event) =>
                        setInviteEmail(event.target.value)
                      }
                      placeholder="teammate@agency.com"
                      className="rounded border border-border bg-surface px-4 py-2 text-sm text-foreground outline-none transition-colors focus:border-accent/40"
                      required
                    />
                    <select
                      value={inviteRole}
                      onChange={(event) =>
                        setInviteRole(
                          event.target.value as "ADMIN" | "MEMBER"
                        )
                      }
                      className="rounded border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-accent/40"
                    >
                      <option value="MEMBER">Member</option>
                      <option value="ADMIN">Admin</option>
                    </select>
                    <button
                      type="submit"
                      disabled={busyInvite === "invite"}
                      className="rounded bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
                    >
                      {busyInvite === "invite" ? "Inviting..." : "Invite"}
                    </button>
                    {memberError && (
                      <p className="sm:col-span-3 text-sm text-error">
                        {memberError}
                      </p>
                    )}
                  </form>
                )}
              </section>
              </div>
            ))}

          {activeTab === "usage" &&
            (usageLoading ? (
              <div className="panel p-8 h-64" />
            ) : (
              <section className="panel p-6">
                <div className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      DMs sent this month
                    </p>
                    <p className="text-xs text-muted mt-0.5">
                      Self-hosted — no plan limits.
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-foreground">
                    {data?.workspace.dmsSentThisPeriod ?? 0}
                  </span>
                </div>
              </section>
            ))}
        </div>
      </div>
    </div>
  );
}
