import { describe, expect, it } from "vitest";
import { classifyTokenExpiry } from "../lib/token-expiry";

const NOW = new Date("2026-05-24T12:00:00.000Z").getTime();

function daysFromNow(days: number): string {
  return new Date(NOW + days * 24 * 60 * 60 * 1000).toISOString();
}

describe("classifyTokenExpiry", () => {
  it("returns a muted 'not available' status when there's no expiry date", () => {
    expect(classifyTokenExpiry(null, NOW)).toEqual({
      days: null,
      tone: "muted",
      label: "Token expiry not available",
    });
  });

  it("flags an already-expired token as an error", () => {
    const result = classifyTokenExpiry(daysFromNow(-2), NOW);
    expect(result.tone).toBe("error");
    expect(result.label).toBe("Token expired");
  });

  it("warns when expiry is within the threshold, with correct pluralization", () => {
    const oneDay = classifyTokenExpiry(daysFromNow(1), NOW);
    expect(oneDay.tone).toBe("warning");
    expect(oneDay.label).toBe("Token expires in 1 day");

    const fiveDays = classifyTokenExpiry(daysFromNow(5), NOW);
    expect(fiveDays.tone).toBe("warning");
    expect(fiveDays.label).toBe("Token expires in 5 days");

    const atThreshold = classifyTokenExpiry(daysFromNow(10), NOW);
    expect(atThreshold.tone).toBe("warning");
  });

  it("stays muted with a plain date once past the warning threshold", () => {
    const result = classifyTokenExpiry(daysFromNow(30), NOW);
    expect(result.tone).toBe("muted");
    expect(result.label).toMatch(/^Token expires \d/);
  });
});
