"use client";

import { useId } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface StatChartPoint {
  date: string;
  value: number;
}

interface StatChartProps {
  title: string;
  data: StatChartPoint[];
  color: string;
  valueFormatter?: (value: number) => string;
}

export function StatChart({ title, data, color, valueFormatter }: StatChartProps) {
  const gradientId = `stat-chart-fill-${useId()}`;

  return (
    <div className="panel p-4">
      <p className="text-sm text-muted">{title}</p>
      <div style={{ width: "100%", height: 220 }} className="mt-2">
        {data.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-muted">
            No data for this range
          </div>
        ) : (
        <ResponsiveContainer>
          <AreaChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.35} />
                <stop offset="95%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fill: "var(--color-muted)", fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: "var(--color-border)" }}
              minTickGap={24}
            />
            <YAxis
              tick={{ fill: "var(--color-muted)", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={36}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{
                background: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                borderRadius: 8,
                fontSize: 12,
              }}
              labelStyle={{ color: "var(--color-foreground)" }}
              itemStyle={{ color }}
              formatter={(value) => (valueFormatter ? valueFormatter(Number(value)) : value)}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={2}
              fill={`url(#${gradientId})`}
            />
          </AreaChart>
        </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

interface MiniTrendChartProps {
  data: { date: string; sent: number; clicks: number }[];
}

// Compact two-series sparkline for per-campaign cards — no axes or gridlines,
// just enough to see the shape of a campaign's activity at a glance.
export function MiniTrendChart({ data }: MiniTrendChartProps) {
  const sentGradientId = `mini-chart-sent-${useId()}`;
  const clicksGradientId = `mini-chart-clicks-${useId()}`;

  return (
    <div style={{ width: "100%", height: 64 }}>
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 2, right: 2, left: 2, bottom: 0 }}>
          <defs>
            <linearGradient id={sentGradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--color-accent)" stopOpacity={0.3} />
              <stop offset="95%" stopColor="var(--color-accent)" stopOpacity={0} />
            </linearGradient>
            <linearGradient id={clicksGradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--color-stat-clicks)" stopOpacity={0.3} />
              <stop offset="95%" stopColor="var(--color-stat-clicks)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <Tooltip
            contentStyle={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              borderRadius: 8,
              fontSize: 11,
              padding: "6px 8px",
            }}
            labelStyle={{ color: "var(--color-foreground)" }}
            labelFormatter={(_, payload) => payload?.[0]?.payload?.date ?? ""}
          />
          <Area
            type="monotone"
            dataKey="sent"
            name="Sent"
            stroke="var(--color-accent)"
            strokeWidth={1.5}
            fill={`url(#${sentGradientId})`}
          />
          <Area
            type="monotone"
            dataKey="clicks"
            name="Clicks"
            stroke="var(--color-stat-clicks)"
            strokeWidth={1.5}
            fill={`url(#${clicksGradientId})`}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

interface SparklineProps {
  data: { date: string; value: number }[];
  color?: string;
  height?: number;
  valueLabel?: string;
}

// Single-series compact chart — no axes, just the shape of a trend, for
// tucking a small graph into a summary panel without much space to spare.
export function Sparkline({
  data,
  color = "var(--color-accent)",
  height = 72,
  valueLabel = "Value",
}: SparklineProps) {
  const gradientId = `sparkline-fill-${useId()}`;

  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 2, right: 2, left: 2, bottom: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.3} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Tooltip
            contentStyle={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              borderRadius: 8,
              fontSize: 11,
              padding: "6px 8px",
            }}
            labelStyle={{ color: "var(--color-foreground)" }}
            labelFormatter={(_, payload) => payload?.[0]?.payload?.date ?? ""}
          />
          <Area
            type="monotone"
            dataKey="value"
            name={valueLabel}
            stroke={color}
            strokeWidth={1.5}
            fill={`url(#${gradientId})`}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
