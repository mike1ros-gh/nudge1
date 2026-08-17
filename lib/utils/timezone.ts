/**
 * Vercel's Node.js runtime defaults to UTC, not a workspace owner's local
 * time, so "today" computed with plain `new Date()` day boundaries flips
 * at UTC midnight. These helpers pin day/month boundaries to a workspace's
 * configured UTC offset instead, so stats like "DMs sent today" match the
 * owner's actual calendar day. A fixed offset rather than an IANA
 * timezone — simpler to pick from a short GMT list, at the cost of not
 * auto-adjusting for DST twice a year.
 */

export const DEFAULT_UTC_OFFSET_MINUTES = 480; // GMT+8 (Malaysia)

const WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Midnight at `utcOffsetMinutes`, `daysAgo` days before `reference`, as a UTC instant. */
export function dayStart(reference: Date, utcOffsetMinutes: number, daysAgo = 0): Date {
  const offsetMs = utcOffsetMinutes * 60 * 1000;
  const shifted = new Date(reference.getTime() + offsetMs);
  const y = shifted.getUTCFullYear();
  const m = shifted.getUTCMonth();
  const d = shifted.getUTCDate() - daysAgo;
  return new Date(Date.UTC(y, m, d) - offsetMs);
}

/** The 1st of the month at `utcOffsetMinutes`, as a UTC instant. */
export function monthStart(reference: Date, utcOffsetMinutes: number): Date {
  const offsetMs = utcOffsetMinutes * 60 * 1000;
  const shifted = new Date(reference.getTime() + offsetMs);
  const y = shifted.getUTCFullYear();
  const m = shifted.getUTCMonth();
  return new Date(Date.UTC(y, m, 1) - offsetMs);
}

/** "YYYY-MM-DD" for `date` at `utcOffsetMinutes`. */
export function formatDateKey(date: Date, utcOffsetMinutes: number): string {
  const shifted = new Date(date.getTime() + utcOffsetMinutes * 60 * 1000);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const d = String(shifted.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Short weekday name ("Mon") for `date` at `utcOffsetMinutes`. */
export function formatWeekdayShort(date: Date, utcOffsetMinutes: number): string {
  const shifted = new Date(date.getTime() + utcOffsetMinutes * 60 * 1000);
  return WEEKDAYS_SHORT[shifted.getUTCDay()];
}

/** "GMT+8" / "GMT-5" / "GMT+5:30" style label. */
export function formatGmtLabel(utcOffsetMinutes: number): string {
  const sign = utcOffsetMinutes >= 0 ? "+" : "-";
  const abs = Math.abs(utcOffsetMinutes);
  const hours = Math.floor(abs / 60);
  const minutes = abs % 60;
  return minutes === 0 ? `GMT${sign}${hours}` : `GMT${sign}${hours}:${String(minutes).padStart(2, "0")}`;
}
