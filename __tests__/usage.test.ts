import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma, mockTx } = vi.hoisted(() => {
  const tx = {
    workspace: {
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  };

  return {
    mockTx: tx,
    mockPrisma: {
      $transaction: vi.fn((callback: (txArg: typeof tx) => unknown) =>
        callback(tx)
      ),
      workspace: {
        updateMany: vi.fn(),
      },
    },
  };
});

vi.mock("@/lib/db/client", () => ({
  prisma: mockPrisma,
}));

import {
  releaseWorkspaceDMReservation,
  reserveWorkspaceDMSend,
} from "../lib/billing/usage";

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-05-24T12:00:00.000Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("reserveWorkspaceDMSend", () => {
  it("atomically increments usage and returns the current period start", async () => {
    const periodStart = new Date("2026-05-01T00:00:00.000Z");
    mockTx.workspace.updateMany.mockResolvedValueOnce({ count: 0 });
    mockTx.workspace.update.mockResolvedValueOnce({
      usagePeriodStart: periodStart,
    });

    const result = await reserveWorkspaceDMSend("workspace_123");

    expect(result).toEqual({ periodStart });
    expect(mockTx.workspace.update).toHaveBeenCalledWith({
      where: { id: "workspace_123" },
      data: { dmsSentThisPeriod: { increment: 1 } },
      select: { usagePeriodStart: true },
    });
  });
});

describe("releaseWorkspaceDMReservation", () => {
  it("decrements only the reserved period", async () => {
    const periodStart = new Date("2026-05-01T00:00:00.000Z");
    mockPrisma.workspace.updateMany.mockResolvedValue({ count: 1 });

    await releaseWorkspaceDMReservation("workspace_123", periodStart);

    expect(mockPrisma.workspace.updateMany).toHaveBeenCalledWith({
      where: {
        id: "workspace_123",
        usagePeriodStart: periodStart,
        dmsSentThisPeriod: { gt: 0 },
      },
      data: { dmsSentThisPeriod: { decrement: 1 } },
    });
  });

  it("does nothing when periodStart is null", async () => {
    const result = await releaseWorkspaceDMReservation("workspace_123", null);

    expect(result).toEqual({ count: 0 });
    expect(mockPrisma.workspace.updateMany).not.toHaveBeenCalled();
  });
});
