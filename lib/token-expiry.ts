export const TOKEN_EXPIRY_WARNING_DAYS = 10;

export type TokenExpiryTone = "muted" | "warning" | "error";

export interface TokenExpiryStatus {
  days: number | null;
  tone: TokenExpiryTone;
  label: string;
}

// Classifies an Instagram token's expiry for display — used by the Settings
// Accounts tab to color-code and word the "Token expires..." line. `now` is
// passed in rather than read internally so callers can capture it once
// (e.g. at component mount) instead of calling Date.now() during render.
export function classifyTokenExpiry(
  tokenExpiresAt: string | null,
  now: number
): TokenExpiryStatus {
  if (!tokenExpiresAt) {
    return { days: null, tone: "muted", label: "Token expiry not available" };
  }

  const days = Math.ceil(
    (new Date(tokenExpiresAt).getTime() - now) / (1000 * 60 * 60 * 24)
  );

  if (days <= 0) {
    return { days, tone: "error", label: "Token expired" };
  }
  if (days <= TOKEN_EXPIRY_WARNING_DAYS) {
    return {
      days,
      tone: "warning",
      label: `Token expires in ${days} day${days === 1 ? "" : "s"}`,
    };
  }
  return {
    days,
    tone: "muted",
    label: `Token expires ${new Date(tokenExpiresAt).toLocaleDateString()}`,
  };
}
