const SKIPPED_PREFIX = "SKIPPED_";

export interface StatusCountRow {
  status: string;
  _count: number | { status?: number; _all?: number };
}

export interface KeywordCountRow {
  matchedKeyword: string | null;
  _count: number | { matchedKeyword?: number; _all?: number };
}

function getCount(value: StatusCountRow["_count"] | KeywordCountRow["_count"]) {
  if (typeof value === "number") return value;
  if ("status" in value && typeof value.status === "number") {
    return value.status;
  }
  if ("matchedKeyword" in value && typeof value.matchedKeyword === "number") {
    return value.matchedKeyword;
  }
  return value._all ?? 0;
}

export function calculateCtr(clicks: number, sent: number) {
  if (sent <= 0) return 0;
  // Raw clicks can exceed sends (repeat clicks, link-preview bots hitting the
  // tracked URL), which makes a "rate" over 100% — cap it so CTR stays sane.
  return Math.min(100, Number(((clicks / sent) * 100).toFixed(1)));
}

export function summarizeDmStatuses(rows: StatusCountRow[]) {
  return rows.reduce(
    (summary, row) => {
      const count = getCount(row._count);
      if (row.status === "SENT") summary.sent += count;
      if (row.status === "FAILED") summary.failed += count;
      if (row.status.startsWith(SKIPPED_PREFIX)) summary.skipped += count;
      return summary;
    },
    { sent: 0, skipped: 0, failed: 0 }
  );
}

export function normalizeTopKeywords(rows: KeywordCountRow[], limit = 5) {
  return rows
    .filter((row) => row.matchedKeyword)
    .map((row) => ({
      keyword: row.matchedKeyword as string,
      count: getCount(row._count),
    }))
    .sort((a, b) => b.count - a.count || a.keyword.localeCompare(b.keyword))
    .slice(0, limit);
}

/**
 * Keyword stats scoped to a campaign's *current* keyword list, so a keyword
 * removed from the campaign (but with old matches on record) stops showing,
 * and a newly added keyword shows immediately even at a count of 0 — instead
 * of an all-time top-N that can surface stale, no-longer-configured keywords
 * ahead of ones actually in use today. Any-word campaigns have no fixed list
 * to scope to, so they fall back to the historical top-N.
 */
export function activeKeywordCounts(
  keywords: string[],
  matchAnyWord: boolean,
  rows: KeywordCountRow[],
  limit = 5
) {
  if (matchAnyWord || keywords.length === 0) {
    return normalizeTopKeywords(rows, limit);
  }

  const countByKeyword = new Map<string, number>();
  for (const row of rows) {
    if (!row.matchedKeyword) continue;
    const match = keywords.find(
      (k) => k.toLowerCase() === row.matchedKeyword!.toLowerCase()
    );
    if (match) {
      countByKeyword.set(match, (countByKeyword.get(match) ?? 0) + getCount(row._count));
    }
  }

  return keywords
    .map((keyword) => ({ keyword, count: countByKeyword.get(keyword) ?? 0 }))
    .sort((a, b) => b.count - a.count || a.keyword.localeCompare(b.keyword));
}
