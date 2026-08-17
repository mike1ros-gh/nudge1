/**
 * Stat Card
 *
 * Metric panel with label, value, and optional trend. `tone` colors the
 * value to give it visual identity (sent/clicks/ctr/failed/skipped); `size`
 * controls how much weight it carries (lg for hero strips and detail pages,
 * sm for dense grids).
 */

export type StatTone =
  | "default"
  | "sent"
  | "clicks"
  | "ctr"
  | "failed"
  | "skipped"
  | "followers"
  | "active";
export type StatSize = "sm" | "lg";

interface StatCardProps {
  label: string;
  value: string | number;
  trend?: string;
  trendUp?: boolean;
  tone?: StatTone;
  size?: StatSize;
}

const toneClass: Record<StatTone, string> = {
  default: "text-foreground",
  sent: "text-accent",
  clicks: "text-stat-clicks",
  ctr: "text-stat-ctr",
  failed: "text-error",
  skipped: "text-warning",
  // Reuse the CTR/warning hues here rather than adding new tokens — CTR
  // itself isn't shown on the pages that use these two, so there's no clash.
  followers: "text-stat-ctr",
  active: "text-warning",
};

export default function StatCard({
  label,
  value,
  trend,
  trendUp,
  tone = "default",
  size = "sm",
}: StatCardProps) {
  return (
    <div className={`panel p-4 ${size === "lg" ? "sm:p-5" : ""}`}>
      <p className="text-sm text-muted">{label}</p>
      <p
        className={`mt-1 font-bold tabular-nums ${toneClass[tone]} ${
          size === "lg" ? "text-3xl sm:text-4xl" : "text-2xl"
        }`}
      >
        {value}
      </p>
      {trend && (
        <p className={`text-xs mt-1 ${trendUp ? "text-success" : "text-error"}`}>
          {trendUp ? "Up" : "Down"} {trend}
        </p>
      )}
    </div>
  );
}
