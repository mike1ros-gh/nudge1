import { prisma } from "@/lib/db/client";
import { getWorkspaceInstagramAccount } from "@/lib/instagram-accounts";
import { getFollowerGrowth, getUserInfo } from "@/lib/meta/client";
import { decryptToken } from "@/lib/meta/oauth";
import { calculateCtr } from "@/lib/tracking/analytics";
import {
  DEFAULT_UTC_OFFSET_MINUTES,
  dayStart,
  formatDateKey,
} from "@/lib/utils/timezone";
import type { StatisticsRange } from "@/lib/statistics-range";

export type { StatisticsRange } from "@/lib/statistics-range";
export { STATISTICS_RANGES, parseStatisticsRange } from "@/lib/statistics-range";

export interface DailyPoint {
  date: string;
  sent: number;
  clicks: number;
  ctr: number;
}

export interface CampaignStatistics {
  id: string;
  name: string;
  isActive: boolean;
  totalSent: number;
  totalClicks: number;
  avgCtr: number;
  daily: { date: string; sent: number; clicks: number }[];
}

export interface FollowerGrowthPoint {
  date: string;
  gained: number;
}

export interface StatisticsAccountOption {
  id: string;
  username: string;
  instagramId: string;
  name: string | null;
}

export interface StatisticsData {
  days: StatisticsRange;
  daily: DailyPoint[];
  campaigns: CampaignStatistics[];
  followerGrowth: FollowerGrowthPoint[] | null;
  currentFollowers: number | null;
  instagramAccounts: StatisticsAccountOption[];
}

// Ascending chronological order (oldest first) — left-to-right on a chart.
export function buildDateRange(
  now: Date,
  utcOffsetMinutes: number,
  days: number
): string[] {
  const dates: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    dates.push(formatDateKey(dayStart(now, utcOffsetMinutes, i), utcOffsetMinutes));
  }
  return dates;
}

function sumMapValues(map: Map<string, number> | undefined): number {
  if (!map) return 0;
  let total = 0;
  for (const value of map.values()) total += value;
  return total;
}

// Buckets a flat list of {automationId, createdAt} rows into date -> automationId -> count,
// so a single query's worth of rows can answer both the workspace-wide daily
// totals and every campaign's own daily series without re-querying per day
// or per campaign.
export function bucketByDateAndCampaign<T extends { automationId: string; createdAt: Date }>(
  rows: T[],
  utcOffsetMinutes: number
): Map<string, Map<string, number>> {
  const byDate = new Map<string, Map<string, number>>();
  for (const row of rows) {
    const date = formatDateKey(row.createdAt, utcOffsetMinutes);
    if (!byDate.has(date)) byDate.set(date, new Map());
    const byCampaign = byDate.get(date)!;
    byCampaign.set(row.automationId, (byCampaign.get(row.automationId) ?? 0) + 1);
  }
  return byDate;
}

export async function getStatisticsData(
  workspaceId: string,
  days: StatisticsRange,
  instagramAccountId?: string | null
): Promise<StatisticsData> {
  const selectedAccountId =
    instagramAccountId && instagramAccountId !== "all" ? instagramAccountId : null;
  const accountFilter = selectedAccountId
    ? { instagramAccountId: selectedAccountId }
    : {};

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { utcOffsetMinutes: true },
  });
  const utcOffsetMinutes = workspace?.utcOffsetMinutes ?? DEFAULT_UTC_OFFSET_MINUTES;

  const now = new Date();
  const rangeStart = dayStart(now, utcOffsetMinutes, days - 1);
  const dateRange = buildDateRange(now, utcOffsetMinutes, days);

  const [automations, dmRows, clickRows, instagramAccounts, account] =
    await Promise.all([
      prisma.automation.findMany({
        where: { workspaceId, ...accountFilter },
        select: { id: true, name: true, isActive: true },
        orderBy: { createdAt: "asc" },
      }),
      prisma.dmLog.findMany({
        where: {
          workspaceId,
          status: "SENT",
          createdAt: { gte: rangeStart },
          ...accountFilter,
        },
        select: { automationId: true, createdAt: true },
      }),
      prisma.linkClick.findMany({
        where: { workspaceId, createdAt: { gte: rangeStart }, ...accountFilter },
        select: { automationId: true, createdAt: true },
      }),
      prisma.instagramAccount.findMany({
        where: { workspaceId },
        orderBy: { connectedAt: "desc" },
        select: { id: true, username: true, instagramId: true, name: true },
      }),
      getWorkspaceInstagramAccount(workspaceId, instagramAccountId),
    ]);

  const sentByDateCampaign = bucketByDateAndCampaign(dmRows, utcOffsetMinutes);
  const clicksByDateCampaign = bucketByDateAndCampaign(clickRows, utcOffsetMinutes);

  const daily: DailyPoint[] = dateRange.map((date) => {
    const sent = sumMapValues(sentByDateCampaign.get(date));
    const clicks = sumMapValues(clicksByDateCampaign.get(date));
    return { date, sent, clicks, ctr: calculateCtr(clicks, sent) };
  });

  const campaigns: CampaignStatistics[] = automations.map((automation) => {
    const campaignDaily = dateRange.map((date) => ({
      date,
      sent: sentByDateCampaign.get(date)?.get(automation.id) ?? 0,
      clicks: clicksByDateCampaign.get(date)?.get(automation.id) ?? 0,
    }));
    const totalSent = campaignDaily.reduce((sum, d) => sum + d.sent, 0);
    const totalClicks = campaignDaily.reduce((sum, d) => sum + d.clicks, 0);
    return {
      id: automation.id,
      name: automation.name,
      isActive: automation.isActive,
      totalSent,
      totalClicks,
      avgCtr: calculateCtr(totalClicks, totalSent),
      daily: campaignDaily,
    };
  });

  let followerGrowth: FollowerGrowthPoint[] | null = null;
  let currentFollowers: number | null = null;
  if (account?.accessToken) {
    try {
      const token = decryptToken(account.accessToken);
      const [raw, profile] = await Promise.all([
        getFollowerGrowth(token, account.instagramId, days, utcOffsetMinutes),
        getUserInfo(token),
      ]);
      const byDate = new Map(raw.map((point) => [point.date, point.gained]));
      followerGrowth = dateRange.map((date) => ({
        date,
        gained: byDate.get(date) ?? 0,
      }));
      currentFollowers = profile.followers_count ?? null;
    } catch (err) {
      console.error("[Statistics] Follower growth error:", err);
      followerGrowth = null;
      currentFollowers = null;
    }
  }

  return {
    days,
    daily,
    campaigns,
    followerGrowth,
    currentFollowers,
    instagramAccounts,
  };
}
