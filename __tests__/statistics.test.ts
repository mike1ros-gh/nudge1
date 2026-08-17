import { describe, expect, it } from "vitest";
import {
  buildDateRange,
  bucketByDateAndCampaign,
  parseStatisticsRange,
} from "../lib/statistics";

describe("buildDateRange", () => {
  it("returns dates oldest-first, ending on the reference day", () => {
    const reference = new Date("2026-05-24T12:00:00.000Z");
    expect(buildDateRange(reference, 0, 3)).toEqual([
      "2026-05-22",
      "2026-05-23",
      "2026-05-24",
    ]);
  });

  it("shifts by the given UTC offset", () => {
    // 23:30 UTC on the 23rd is already the 24th at UTC+1.
    const reference = new Date("2026-05-23T23:30:00.000Z");
    expect(buildDateRange(reference, 60, 1)).toEqual(["2026-05-24"]);
  });
});

describe("bucketByDateAndCampaign", () => {
  it("groups rows by date, then by automationId, counting occurrences", () => {
    const rows = [
      { automationId: "a1", createdAt: new Date("2026-05-24T01:00:00.000Z") },
      { automationId: "a1", createdAt: new Date("2026-05-24T05:00:00.000Z") },
      { automationId: "a2", createdAt: new Date("2026-05-24T09:00:00.000Z") },
      { automationId: "a2", createdAt: new Date("2026-05-23T01:00:00.000Z") },
    ];

    const result = bucketByDateAndCampaign(rows, 0);

    expect(result.get("2026-05-24")?.get("a1")).toBe(2);
    expect(result.get("2026-05-24")?.get("a2")).toBe(1);
    expect(result.get("2026-05-23")?.get("a2")).toBe(1);
    expect(result.get("2026-05-23")?.get("a1")).toBeUndefined();
  });

  it("returns an empty map for no rows", () => {
    expect(bucketByDateAndCampaign([], 0).size).toBe(0);
  });
});

describe("parseStatisticsRange", () => {
  it("accepts the three supported ranges", () => {
    expect(parseStatisticsRange("7")).toBe(7);
    expect(parseStatisticsRange("30")).toBe(30);
    expect(parseStatisticsRange("90")).toBe(90);
  });

  it("defaults to 30 for missing, invalid, or unsupported values", () => {
    expect(parseStatisticsRange(null)).toBe(30);
    expect(parseStatisticsRange("abc")).toBe(30);
    expect(parseStatisticsRange("14")).toBe(30);
    expect(parseStatisticsRange("-7")).toBe(30);
  });
});
