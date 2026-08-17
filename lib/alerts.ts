import { prisma } from "@/lib/db/client";
import { getWorkerHealth } from "@/lib/ops/worker-health";
import { getUpstashUsage } from "@/lib/ops/upstash-usage";
import { TOKEN_EXPIRY_WARNING_DAYS } from "@/lib/token-expiry";

const REDIS_USAGE_WARNING_RATIO = 0.9;

async function sendEmail(to: string, subject: string, text: string) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? "Nudge1 <alerts@example.com>";
  if (!apiKey) return;

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to, subject, text }),
  });
}

// Checks one workspace's health and emails the owner if something needs
// attention. Called once a day from the refresh-tokens cron — that cadence
// is also what naturally caps this to at most one email per day, since
// there's no separate de-dup/cooldown state to maintain.
export async function checkAndSendAlerts(workspaceId: string): Promise<void> {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: {
      name: true,
      alertsEnabled: true,
      owner: { select: { email: true } },
    },
  });
  if (!workspace?.alertsEnabled || !workspace.owner.email) return;

  const issues: string[] = [];

  const health = await getWorkerHealth();
  if (!health.healthy) {
    issues.push(
      health.stalled
        ? `Worker looks stalled — ${health.queueWaiting} job(s) waiting with no recent activity.`
        : "Worker hasn't sent a heartbeat recently — it may not be running."
    );
  }

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() + TOKEN_EXPIRY_WARNING_DAYS);
  const expiringAccounts = await prisma.instagramAccount.findMany({
    where: { workspaceId, tokenExpiresAt: { not: null, lte: cutoff } },
    select: { username: true, tokenExpiresAt: true },
  });
  for (const account of expiringAccounts) {
    const days = Math.ceil(
      (account.tokenExpiresAt!.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    issues.push(
      days <= 0
        ? `@${account.username}'s Instagram token has expired.`
        : `@${account.username}'s Instagram token expires in ${days} day(s).`
    );
  }

  const redisUsage = await getUpstashUsage();
  if (redisUsage?.limit != null && redisUsage.used / redisUsage.limit >= REDIS_USAGE_WARNING_RATIO) {
    issues.push(
      `Redis usage is at ${redisUsage.used.toLocaleString()} / ${redisUsage.limit.toLocaleString()} for the month.`
    );
  }

  if (issues.length === 0) return;

  await sendEmail(
    workspace.owner.email,
    `Nudge1: ${workspace.name} needs attention`,
    `${issues.map((issue) => `- ${issue}`).join("\n")}\n\nFull details: check the Diagnostics page in your Nudge1 dashboard.`
  );
}
