"use client";

import { useEffect, useState } from "react";
import AccountSelect, { type AccountOption } from "@/components/account-select";
import StatCard from "@/components/stat-card";
import { MiniTrendChart, StatChart } from "@/components/stat-chart";
import { STATISTICS_RANGES, type StatisticsRange } from "@/lib/statistics-range";
import { calculateCtr } from "@/lib/tracking/analytics";

interface DailyPoint {
  date: string;
  sent: number;
  clicks: number;
  ctr: number;
}

interface CampaignStatistics {
  id: string;
  name: string;
  isActive: boolean;
  totalSent: number;
  totalClicks: number;
  avgCtr: number;
  daily: { date: string; sent: number; clicks: number }[];
}

interface FollowerGrowthPoint {
  date: string;
  gained: number;
}

interface StatisticsResponse {
  days: StatisticsRange;
  daily: DailyPoint[];
  campaigns: CampaignStatistics[];
  followerGrowth: FollowerGrowthPoint[] | null;
  currentFollowers: number | null;
  instagramAccounts: AccountOption[];
}

function shortDate(dateKey: string): string {
  const parts = dateKey.split("-");
  return `${parts[1]}/${parts[2]}`;
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function average(values: number[]): number {
  return values.length ? sum(values) / values.length : 0;
}

export default function StatisticsPage() {
  const [range, setRange] = useState<StatisticsRange>(30);
  const [accountId, setAccountId] = useState("all");
  const [data, setData] = useState<StatisticsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadStatistics() {
      const params = new URLSearchParams({
        days: String(range),
        instagramAccountId: accountId,
      });
      const response = await fetch(`/api/statistics?${params}`);
      const payload = await response.json();
      if (active && payload.success) {
        setData(payload.data);
      }
      if (active) {
        setLoading(false);
      }
    }

    void loadStatistics();

    return () => {
      active = false;
    };
  }, [range, accountId]);

  if (loading && !data) {
    return <div className="panel rounded p-8 h-64" />;
  }

  if (!data) {
    return (
      <div className="panel rounded p-8 text-sm text-muted">
        Couldn&apos;t load statistics.
      </div>
    );
  }

  const totalSent = sum(data.daily.map((d) => d.sent));
  const totalClicks = sum(data.daily.map((d) => d.clicks));
  const avgCtr = calculateCtr(totalClicks, totalSent);
  const followersGained = data.followerGrowth
    ? sum(data.followerGrowth.map((d) => d.gained))
    : null;
  const avgDailySent = Number(average(data.daily.map((d) => d.sent)).toFixed(1));

  const exportParams = new URLSearchParams({
    days: String(range),
    instagramAccountId: accountId,
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="inline-flex shrink-0 rounded-lg bg-surface p-1">
            {STATISTICS_RANGES.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRange(r)}
                className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                  range === r
                    ? "bg-background font-medium text-foreground ring-1 ring-accent/40"
                    : "text-muted hover:text-foreground"
                }`}
              >
                {r} days
              </button>
            ))}
          </div>
          {data.instagramAccounts.length > 1 && (
            <AccountSelect
              accounts={data.instagramAccounts}
              value={accountId}
              onChange={setAccountId}
            />
          )}
        </div>
        <a
          href={`/api/statistics/export?${exportParams}`}
          className="px-4 py-2 rounded border border-border text-sm font-medium text-muted hover:text-foreground"
        >
          Export to Excel
        </a>
      </div>

      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <StatCard
          label="Followers"
          value={data.currentFollowers != null ? data.currentFollowers.toLocaleString() : "—"}
          trend={followersGained != null ? `${followersGained >= 0 ? "+" : ""}${followersGained} this period` : undefined}
          trendUp={followersGained != null ? followersGained >= 0 : undefined}
          size="lg"
        />
        <StatCard label="DMs Sent" value={totalSent.toLocaleString()} tone="sent" size="lg" />
        <StatCard label="Clicks" value={totalClicks.toLocaleString()} tone="clicks" size="lg" />
        <StatCard label="Avg CTR" value={`${avgCtr}%`} tone="ctr" size="lg" />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <StatChart
          title="Follower growth (daily gain)"
          color="var(--color-success)"
          data={
            data.followerGrowth?.map((d) => ({ date: shortDate(d.date), value: d.gained })) ?? []
          }
        />
        <StatChart
          title="DMs sent per day"
          color="var(--color-accent)"
          data={data.daily.map((d) => ({ date: shortDate(d.date), value: d.sent }))}
        />
        <StatChart
          title="Clicks per day"
          color="var(--color-stat-clicks)"
          data={data.daily.map((d) => ({ date: shortDate(d.date), value: d.clicks }))}
        />
        <StatChart
          title="CTR per day"
          color="var(--color-stat-ctr)"
          data={data.daily.map((d) => ({ date: shortDate(d.date), value: d.ctr }))}
          valueFormatter={(v) => `${v}%`}
        />
      </div>

      <p className="text-xs text-muted">Average {avgDailySent} DMs sent per day over the selected range.</p>

      <div>
        <h2 className="text-sm font-semibold text-foreground mb-3">By campaign</h2>
        {data.campaigns.length === 0 ? (
          <div className="panel rounded p-6 text-sm text-muted">No campaigns yet.</div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.campaigns.map((campaign) => (
              <div key={campaign.id} className="panel p-4">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold truncate flex-1">{campaign.name}</h3>
                  <span
                    className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${
                      campaign.isActive
                        ? "bg-success/10 text-success"
                        : "bg-zinc-500/10 text-zinc-400"
                    }`}
                  >
                    {campaign.isActive ? "Active" : "Paused"}
                  </span>
                </div>
                <div className="mt-3">
                  <MiniTrendChart data={campaign.daily.map((d) => ({ ...d, date: shortDate(d.date) }))} />
                </div>
                <div className="mt-3 flex items-center gap-4 text-xs">
                  <span className="text-accent font-medium">{campaign.totalSent} sent</span>
                  <span className="text-stat-clicks font-medium">{campaign.totalClicks} clicks</span>
                  <span className="text-stat-ctr font-medium">{campaign.avgCtr}% CTR</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
