// Split out from lib/statistics.ts so client components can import the
// range type/constant without pulling in that file's Prisma/pg dependency
// chain into the browser bundle.

export type StatisticsRange = 7 | 30 | 90;

export const STATISTICS_RANGES: StatisticsRange[] = [7, 30, 90];

export function parseStatisticsRange(value: string | null): StatisticsRange {
  const parsed = Number(value);
  return STATISTICS_RANGES.includes(parsed as StatisticsRange)
    ? (parsed as StatisticsRange)
    : 30;
}
