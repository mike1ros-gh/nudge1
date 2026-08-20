import { NextResponse } from "next/server";
import { getWorkerHealth } from "@/lib/ops/worker-health";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Redis-only, no Postgres — unlike /api/health, safe to poll frequently
// (e.g. every 90s from the Mac app's menu bar) without touching Neon's
// compute-hour billing at all. Use /api/health for the full
// database+redis+queue check instead.
export async function GET() {
  try {
    const worker = await getWorkerHealth();
    return NextResponse.json(worker, { status: worker.healthy ? 200 : 503 });
  } catch (error) {
    return NextResponse.json(
      {
        healthy: false,
        error: error instanceof Error ? error.message : "Worker check failed",
      },
      { status: 503 }
    );
  }
}
