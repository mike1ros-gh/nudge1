import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { AI_SETUP_PROMPT } from "@/lib/ai-setup-prompt";
import CopyPromptButton from "@/components/copy-prompt-button";

export const metadata: Metadata = {
  title: "Nudge1 - Open source Instagram comment-to-DM automation",
  description:
    "A free, self-hosted Instagram automation tool. Turn keyword comments into automatic private replies using the official Meta API.",
};

const GITHUB_URL = "https://github.com/mike1ros-gh/nudge1";
// Please don't remove this — Nudge1 is free to self-host because of it.
// See docs/setup.md.
const BMC_URL = "https://buymeacoffee.com/mike1ros.jpg";

function formatStars(count: number): string {
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K`;
  }
  return count.toLocaleString();
}

const githubIconPath =
  "M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z";

// Matches components/sidebar.tsx's BrandMark exactly and
// mac-app/gen_icon.swift's Dock icon — the "Nudge1" name and this gradient
// mark are the project's whole identity, please don't restyle either one.
const BRAND_GRADIENT =
  "linear-gradient(135deg, #FEDA75 0%, #FA7E1E 25%, #D62976 50%, #962FBF 75%, #4F5BD5 100%)";

function BrandMark({ size = 32 }: { size?: number }) {
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-lg font-bold text-white"
      style={{
        background: BRAND_GRADIENT,
        width: size,
        height: size,
        fontSize: size * 0.38,
      }}
    >
      N1
    </div>
  );
}

const heroStats = [
  { value: "24/7", label: "Comment monitoring" },
  { value: "1", label: "DM per matched comment" },
  { value: "0", label: "Scraping required" },
];

const flowSteps = [
  {
    number: "01",
    title: "Connect",
    description:
      "Sign in by email and link your Instagram professional account once. No password sharing, no browser automation.",
  },
  {
    number: "02",
    title: "Build",
    description:
      "Create a campaign for a post or reel: the keyword to watch, the public reply, and the DM to send.",
  },
  {
    number: "03",
    title: "Deliver",
    description:
      "Webhooks catch comments instantly and a polling sweep catches what the webhook misses. Every send is queued, rate-limited, and logged.",
  },
];

const features = [
  "Email magic-link sign-in",
  "Multiple Instagram accounts",
  "Encrypted tokens at rest",
  "Webhook + polling reconciliation",
  "Queue-backed delivery worker",
  "Per-account rate limiting",
  "Tracked links with click stats",
  "DM logs with full status",
  "No plan limits, fully self-hosted",
];

/* Static, faithful copies of the real Overview and Dashboard screens, built in
   the app's own design tokens so what visitors see is what the app looks like. */

function AppWindow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-background shadow-2xl shadow-black/60">
      <div className="flex items-center gap-2 border-b border-border bg-surface px-4 py-3">
        <span className="h-2.5 w-2.5 rounded-full bg-border" />
        <span className="h-2.5 w-2.5 rounded-full bg-border" />
        <span className="h-2.5 w-2.5 rounded-full bg-border" />
        <span className="ml-2 text-xs text-muted">{label}</span>
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone = "text-foreground",
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="text-sm text-muted">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${tone}`}>{value}</p>
    </div>
  );
}

// A faithful copy of the real home page (Campaigns) — same stat tones,
// same panels, same campaign card layout — with made-up numbers, not a
// real workspace's data.
const campaignStats = [
  { label: "Followers", value: "8,412", tone: "text-stat-ctr" },
  { label: "Active Campaigns", value: "6", tone: "text-foreground" },
  { label: "DMs Sent", value: "1,284", tone: "text-accent" },
  { label: "Clicks", value: "356", tone: "text-stat-clicks" },
  { label: "Contacts", value: "2,140", tone: "text-warning" },
];

const topKeywords = [
  ["GUIDE", "214"],
  ["LINK", "88"],
  ["PRICE", "51"],
];

const recentActivity = [
  ["@maya.co", "Product guide reply", "Sent", "text-success"],
  ["@founder.ray", "Price request", "Sent", "text-success"],
  ["@shop.ava", "Lead magnet", "Queued", "text-warning"],
];

const dailySends = [
  { label: "Today", value: "42" },
  { label: "Yesterday", value: "38" },
  { label: "7-Day Avg", value: "40.1" },
];

const followerGrowth = [
  { label: "Today", value: "+12" },
  { label: "Yesterday", value: "+9" },
  { label: "7-Day Avg", value: "+10.3" },
];

const campaignCards = [
  {
    name: "Spring Guide",
    handle: "studio.store",
    keywords: ["GUIDE", "LINK"],
    message: "Here's your free guide — link's in your inbox!",
    runs: 214,
    ctr: "41.2",
    sent: 198,
    skipped: 12,
    failed: 4,
    clicks: 88,
  },
  {
    name: "Price Check",
    handle: "studio.store",
    keywords: ["PRICE"],
    message: "Our current pricing and next steps, sent your way.",
    runs: 96,
    ctr: "33.8",
    sent: 90,
    skipped: 4,
    failed: 2,
    clicks: 32,
  },
];

// A static approximation of components/stat-chart.tsx's Sparkline (same
// monotone-curve-with-fading-fill look) — no recharts needed for a fixed
// marketing illustration.
function DailySendsSparkline() {
  const path =
    "M0,40 C20,38 30,20 50,22 C70,24 80,44 100,42 C120,40 130,10 150,8 C170,6 180,30 200,28 C220,26 230,14 250,12 C265,10 275,18 280,16";
  return (
    <svg viewBox="0 0 280 56" className="mt-3 h-14 w-full" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="landing-sparkline-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="5%" stopColor="var(--color-accent)" stopOpacity="0.3" />
          <stop offset="95%" stopColor="var(--color-accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${path} L280,56 L0,56 Z`} fill="url(#landing-sparkline-fill)" />
      <path d={path} fill="none" stroke="var(--color-accent)" strokeWidth="1.5" />
    </svg>
  );
}

function CampaignCard({ campaign }: { campaign: (typeof campaignCards)[number] }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground">{campaign.name}</h3>
            <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted">
              @{campaign.handle}
            </span>
            <span className="rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
              Active
            </span>
          </div>
          <div className="mb-2 flex flex-wrap gap-1.5">
            {campaign.keywords.map((kw) => (
              <span
                key={kw}
                className="rounded-md border border-accent/10 bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent"
              >
                {kw}
              </span>
            ))}
          </div>
          <p className="truncate text-sm text-muted">&ldquo;{campaign.message}&rdquo;</p>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
            <span className="font-semibold text-foreground">{campaign.runs} runs</span>
            <span className="font-semibold text-stat-ctr">{campaign.ctr}% CTR</span>
            <span className="font-medium text-accent">{campaign.sent} sent</span>
            <span className="font-medium text-warning">{campaign.skipped} skipped</span>
            <span className="font-medium text-error">{campaign.failed} failed</span>
            <span className="font-medium text-stat-clicks">{campaign.clicks} clicks</span>
          </div>
        </div>
        <div className="relative h-6 w-11 shrink-0 rounded-full bg-accent">
          <span className="absolute left-6 top-1 h-4 w-4 rounded-full bg-white shadow-sm" />
        </div>
      </div>
    </div>
  );
}

function CampaignsPreview() {
  return (
    <AppWindow label="app / campaigns">
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
        {campaignStats.map((stat) => (
          <Stat key={stat.label} label={stat.label} value={stat.value} tone={stat.tone} />
        ))}
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-sm font-semibold text-foreground">Top Keywords</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {topKeywords.map(([word, count]) => (
              <span
                key={word}
                className="rounded-full border border-border px-3 py-1 text-xs text-muted"
              >
                {word}: {count}
              </span>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-sm font-semibold text-foreground">Recent Activity</p>
          <div className="mt-3 space-y-2">
            {recentActivity.map(([user, automation, status, color]) => (
              <div
                key={user}
                className="flex items-center justify-between gap-3 border-b border-border py-2 text-sm last:border-0"
              >
                <span className="truncate text-foreground">{user}</span>
                <span className="truncate text-muted">{automation}</span>
                <span className={`text-sm ${color}`}>{status}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-sm font-semibold text-foreground">Daily Sends</p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {dailySends.map((row) => (
              <div key={row.label}>
                <p className="text-[11px] text-muted">{row.label}</p>
                <p className="mt-0.5 text-sm font-semibold text-foreground">{row.value}</p>
              </div>
            ))}
          </div>
          <DailySendsSparkline />
        </div>

        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-sm font-semibold text-foreground">Follower Growth</p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {followerGrowth.map((row) => (
              <div key={row.label}>
                <p className="text-[11px] text-muted">{row.label}</p>
                <p className="mt-0.5 text-sm font-semibold text-foreground">{row.value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-sm font-semibold text-foreground">System Status</p>
          <div className="mt-3 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted">Worker</span>
              <span className="font-semibold text-success">Running</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted">Redis</span>
              <span className="font-semibold text-foreground">84,204 / 500K</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">2 campaigns</p>
        <div className="flex gap-2">
          <span className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted">
            Import
          </span>
          <span className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white">
            New Campaign
          </span>
        </div>
      </div>
      <div className="mt-3 rounded-lg border border-border bg-surface px-3 py-2 text-xs text-muted">
        Search campaigns by name, keyword, or message…
      </div>
      <div className="mt-3 space-y-3">
        {campaignCards.map((campaign) => (
          <CampaignCard key={campaign.name} campaign={campaign} />
        ))}
      </div>
    </AppWindow>
  );
}

// The second showcase moment zooms into just the campaign cards — same
// real layout as CampaignsPreview's list, larger and on their own, to
// back up the "every event is traceable" copy next to it.
function CampaignDetailPreview() {
  return (
    <AppWindow label="app / campaigns">
      <div className="space-y-3">
        {campaignCards.map((campaign) => (
          <CampaignCard key={campaign.name} campaign={campaign} />
        ))}
      </div>
    </AppWindow>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4 shrink-0 fill-accent">
      <path
        fillRule="evenodd"
        d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0l-3.5-3.5a1 1 0 1 1 1.4-1.4l2.8 2.8 6.8-6.8a1 1 0 0 1 1.4 0Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

// A soft, low-opacity radial glow behind hero content — the app's own
// dashboard UI is deliberately gradient-free, but this marketing page is a
// different surface and can afford one tasteful moment of depth.
function Glow({ className }: { className: string }) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute -z-10 rounded-full blur-3xl ${className}`}
      style={{
        background:
          "radial-gradient(circle, color-mix(in srgb, var(--color-accent) 35%, transparent) 0%, transparent 70%)",
      }}
    />
  );
}

async function getGitHubStars(): Promise<number | null> {
  try {
    const res = await fetch("https://api.github.com/repos/mike1ros-gh/nudge1", {
      headers: { Accept: "application/vnd.github+json" },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { stargazers_count?: number };
    return typeof data.stargazers_count === "number" ? data.stargazers_count : null;
  } catch {
    return null;
  }
}

export default async function Home() {
  const session = await auth();
  if (session?.user?.id) {
    redirect("/campaigns");
  }

  const stars = await getGitHubStars();
  // Set NEXT_PUBLIC_SHOWCASE=true only on the public-facing showcase
  // deployment (nudge1-app.vercel.app) — everyone's own real, working
  // instance should offer a login, not marketing copy.
  const isShowcase = process.env.NEXT_PUBLIC_SHOWCASE === "true";
  return (
    <main className="relative min-h-screen overflow-x-hidden bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-5 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2.5" aria-label="Nudge1 home">
            <BrandMark size={30} />
            <span className="text-base font-semibold text-foreground">Nudge1</span>
          </Link>

          <div className="flex items-center gap-0.5 sm:gap-2">
            <a
              href={BMC_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted transition hover:bg-white/5 hover:text-foreground sm:h-11 sm:w-11"
              aria-label="Buy me a coffee"
              title="Buy me a coffee"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-current sm:h-6 sm:w-6">
                <path d="M18.5 3H2v10a5 5 0 0 0 5 5h5a5 5 0 0 0 5-5v-1h1.5a3.5 3.5 0 0 0 0-7H18.5V3ZM18 6.5h.5a1 1 0 0 1 0 2H18v-2ZM8 20h4a1 1 0 1 1 0 2H8a1 1 0 1 1 0-2Z" />
              </svg>
            </a>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-2 text-sm font-medium text-muted transition hover:bg-white/5 hover:text-foreground sm:gap-2 sm:px-3"
              aria-label="View Nudge1 on GitHub"
            >
              <svg viewBox="0 0 16 16" aria-hidden="true" className="h-4 w-4 fill-current">
                <path d={githubIconPath} />
              </svg>
              {stars !== null && <span>{formatStars(stars)}</span>}
            </a>
            {isShowcase ? (
              <a
                href={GITHUB_URL}
                target="_blank"
                rel="noreferrer"
                className="ml-0.5 inline-flex h-9 shrink-0 items-center justify-center whitespace-nowrap rounded-full bg-accent px-2.5 text-xs font-semibold text-white transition hover:bg-accent-hover sm:ml-1 sm:px-4 sm:text-sm"
              >
                TOTALLY FREE!
              </a>
            ) : (
              <Link
                href="/login"
                className="ml-0.5 inline-flex h-9 shrink-0 items-center justify-center whitespace-nowrap rounded-full bg-accent px-2.5 text-xs font-semibold text-white transition hover:bg-accent-hover sm:ml-1 sm:px-4 sm:text-sm"
              >
                Login
              </Link>
            )}
          </div>
        </div>
      </header>

      <section className="relative px-5 pb-24 pt-24 sm:px-6 sm:pt-32 lg:px-8">
        <Glow className="left-1/2 top-0 h-[560px] w-[900px] -translate-x-1/2 opacity-60" />

        <div className="mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface/60 px-3.5 py-1.5 text-sm font-medium text-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-success" />
            Open source · Official Meta API
          </div>

          <h1 className="mt-5 text-balance text-5xl font-semibold leading-[1.05] tracking-tight text-foreground sm:text-6xl lg:text-7xl">
            Make every comment
            <br />
            start the{" "}
            <span
              className="bg-clip-text text-transparent"
              style={{ backgroundImage: BRAND_GRADIENT }}
            >
              right DM
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-xl text-balance text-lg leading-8 text-muted">
            When someone comments your keyword on a post or reel, they get
            your DM a second later. Free, self-hosted, and built on the
            official Instagram API.
          </p>

          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a
              href="#install"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-accent px-7 py-3 text-sm font-semibold text-white shadow-lg shadow-accent/20 transition hover:bg-accent-hover hover:shadow-accent/30"
            >
              Get started
            </a>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-surface/60 px-7 py-3 text-sm font-semibold text-foreground transition hover:border-border-hover hover:bg-surface-hover"
            >
              <svg viewBox="0 0 16 16" aria-hidden="true" className="h-4 w-4 fill-current">
                <path d={githubIconPath} />
              </svg>
              GitHub
            </a>
            <a
              href="#how"
              className="inline-flex items-center justify-center rounded-full border border-border bg-surface/60 px-7 py-3 text-sm font-semibold text-foreground transition hover:border-border-hover hover:bg-surface-hover"
            >
              See how it works
            </a>
          </div>

          <dl className="mx-auto mt-14 grid max-w-xl grid-cols-3 gap-3">
            {heroStats.map((stat) => (
              <div key={stat.label} className="rounded-2xl border border-border bg-surface/60 p-4">
                <dt className="text-2xl font-semibold text-foreground">{stat.value}</dt>
                <dd className="mt-1 text-xs leading-5 text-muted">{stat.label}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="relative mx-auto mt-16 max-w-5xl">
          <CampaignsPreview />
        </div>
      </section>

      <section id="install" className="mx-auto w-full max-w-6xl px-5 pb-24 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-accent">
            Get started
          </p>
          <h2 className="mt-3 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
            Paste this into your AI assistant
          </h2>
          <p className="mt-5 text-base leading-8 text-muted">
            Open Claude Code or Cursor, paste the prompt below, and it clones
            the repo and walks you through hosting it in plain language —
            free database, free Redis, free web hosting. No coding required.
          </p>
        </div>

        <div className="mx-auto mt-10 max-w-3xl overflow-hidden rounded-2xl border border-border bg-surface/60">
          <div className="flex items-center justify-between border-b border-border/60 px-5 py-3">
            <span className="text-xs font-medium uppercase tracking-wide text-muted">
              Copy-paste prompt
            </span>
            <CopyPromptButton text={AI_SETUP_PROMPT} />
          </div>
          <pre className="max-h-80 overflow-y-auto whitespace-pre-wrap px-5 py-5 text-left text-xs leading-6 text-muted">
            {AI_SETUP_PROMPT}
          </pre>
        </div>

        <p className="mx-auto mt-4 max-w-3xl text-center text-xs text-muted">
          Full manual setup guide is in{" "}
          <a
            href={`${GITHUB_URL}/blob/main/docs/setup.md`}
            target="_blank"
            rel="noreferrer"
            className="underline hover:text-foreground"
          >
            docs/setup.md
          </a>
          .
        </p>
      </section>

      <section id="how" className="mx-auto w-full max-w-6xl px-5 py-24 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-accent">
            How it works
          </p>
          <h2 className="mt-3 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
            A comment in, a DM out
          </h2>
          <p className="mt-5 text-base leading-8 text-muted">
            Three steps. Connect an account, build a campaign, and let it
            run. The webhook handles it live and the poll sweeps up whatever
            the webhook misses.
          </p>
        </div>

        <div className="mt-14 grid gap-5 sm:grid-cols-3">
          {flowSteps.map((step) => (
            <article
              key={step.title}
              className="rounded-2xl border border-border bg-surface/60 p-6 transition hover:border-border-hover hover:bg-surface"
            >
              <p className="text-3xl font-semibold text-accent/40">{step.number}</p>
              <h3 className="mt-3 text-lg font-semibold text-foreground">{step.title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted">{step.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="relative border-y border-border/60 bg-surface/30 py-24">
        <Glow className="right-0 top-1/2 h-[400px] w-[500px] -translate-y-1/2 opacity-30" />
        <div className="mx-auto grid w-full max-w-6xl gap-12 px-5 sm:px-6 lg:grid-cols-[1.08fr_0.92fr] lg:items-center lg:px-8">
          <CampaignDetailPreview />

          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-accent">
              Full visibility
            </p>
            <h2 className="mt-3 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
              See exactly what happened
            </h2>
            <p className="mt-5 text-base leading-8 text-muted">
              Every comment event is traceable: queued, matched, sent,
              skipped, failed, or rate-limited. Worker health and Redis usage
              right there too. No black box.
            </p>
          </div>
        </div>
      </section>

      <section id="features" className="mx-auto w-full max-w-6xl px-5 py-24 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-accent">
            What&rsquo;s included
          </p>
          <h2 className="mt-3 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
            Everything, no tiers
          </h2>
          <p className="mt-5 text-base leading-8 text-muted">
            It is self-hosted and open source, so there is nothing to
            unlock. You run it, you own it.
          </p>
        </div>

        <div className="mx-auto mt-12 grid max-w-4xl gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature}
              className="flex items-center gap-2.5 rounded-xl border border-border bg-surface/60 px-4 py-3.5 text-sm font-medium text-foreground"
            >
              <CheckIcon />
              {feature}
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-5 pb-24 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl border border-border bg-surface p-10 text-center sm:p-16">
          <Glow className="left-1/2 top-1/2 h-[400px] w-[600px] -translate-x-1/2 -translate-y-1/2 opacity-25" />
          <h2 className="mx-auto max-w-2xl text-balance text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
            Turn your next reel&rsquo;s comments into DMs
          </h2>
          <p className="mt-4 text-base text-muted">
            Free and open source. Star it if it saves you a subscription.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a
              href="#install"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-accent px-7 py-3 text-sm font-semibold text-white shadow-lg shadow-accent/20 transition hover:bg-accent-hover"
            >
              Get started
            </a>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center rounded-full border border-border bg-background/60 px-7 py-3 text-sm font-semibold text-foreground transition hover:border-border-hover hover:bg-surface-hover"
            >
              View on GitHub
            </a>
          </div>
        </div>
      </section>

      <footer className="border-t border-border/60 py-10">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-6 px-5 sm:flex-row sm:px-6 lg:px-8">
          <div className="flex items-center gap-2.5">
            <BrandMark size={24} />
            <span className="text-sm font-semibold text-foreground">Nudge1</span>
          </div>
          <div className="flex items-center gap-5 text-sm text-muted">
            <a href="/privacy" className="transition hover:text-foreground">
              Privacy
            </a>
            <a href="/terms" className="transition hover:text-foreground">
              Terms
            </a>
            <a
              href={BMC_URL}
              target="_blank"
              rel="noreferrer"
              className="transition hover:text-foreground"
            >
              Donate
            </a>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 transition hover:text-foreground"
            >
              <svg viewBox="0 0 16 16" aria-hidden="true" className="h-4 w-4 fill-current">
                <path d={githubIconPath} />
              </svg>
              {stars !== null && <span>{formatStars(stars)}</span>}
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}
