import ExcelJS from "exceljs";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentWorkspaceId } from "@/lib/auth";
import { getStatisticsData, parseStatisticsRange } from "@/lib/statistics";
import { addSheet } from "@/lib/excel";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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

  const { daily, campaigns, followerGrowth } = await getStatisticsData(
    workspaceId,
    days,
    instagramAccountId
  );

  const followersByDate = new Map(
    followerGrowth?.map((point) => [point.date, point.gained]) ?? []
  );

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Nudge1";
  workbook.created = new Date();

  addSheet(
    workbook,
    "Daily Totals",
    [
      { header: "Date", key: "date", width: 14 },
      { header: "DMs Sent", key: "sent", width: 12 },
      { header: "Clicks", key: "clicks", width: 10 },
      { header: "CTR %", key: "ctr", width: 10 },
      { header: "Followers Gained", key: "followersGained", width: 18 },
    ],
    daily.map((point) => ({
      date: point.date,
      sent: point.sent,
      clicks: point.clicks,
      ctr: point.ctr,
      followersGained: followerGrowth ? followersByDate.get(point.date) ?? 0 : "",
    }))
  );

  addSheet(
    workbook,
    "Campaigns",
    [
      { header: "Date", key: "date", width: 14 },
      { header: "Campaign", key: "campaign", width: 28 },
      { header: "Status", key: "status", width: 10 },
      { header: "DMs Sent", key: "sent", width: 12 },
      { header: "Clicks", key: "clicks", width: 10 },
    ],
    campaigns.flatMap((campaign) =>
      campaign.daily.map((point) => ({
        date: point.date,
        campaign: campaign.name,
        status: campaign.isActive ? "Active" : "Paused",
        sent: point.sent,
        clicks: point.clicks,
      }))
    )
  );

  const buffer = await workbook.xlsx.writeBuffer();

  return new NextResponse(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="nudge1-statistics-${days}days.xlsx"`,
    },
  });
}
