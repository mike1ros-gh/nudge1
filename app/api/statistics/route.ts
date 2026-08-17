import { NextRequest, NextResponse } from "next/server";
import { getCurrentWorkspaceId } from "@/lib/auth";
import { getStatisticsData, parseStatisticsRange } from "@/lib/statistics";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const days = parseStatisticsRange(request.nextUrl.searchParams.get("days"));
  const instagramAccountId = request.nextUrl.searchParams.get("instagramAccountId");

  const data = await getStatisticsData(workspaceId, days, instagramAccountId);

  return NextResponse.json({ success: true, data });
}
