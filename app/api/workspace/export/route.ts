import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { getCurrentWorkspaceId } from "@/lib/auth";
import { prisma } from "@/lib/db/client";
import { addSheet } from "@/lib/excel";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET() {
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const [automations, dmLogs, trackedLinks] = await Promise.all([
    prisma.automation.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "asc" },
      select: {
        name: true,
        goal: true,
        isActive: true,
        keywords: true,
        dmMessage: true,
        publicReplyEnabled: true,
        createdAt: true,
      },
    }),
    prisma.dmLog.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "asc" },
      select: {
        commenterName: true,
        commentText: true,
        matchedKeyword: true,
        status: true,
        dmSentAt: true,
        errorMessage: true,
        createdAt: true,
      },
    }),
    prisma.trackedLink.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "asc" },
      select: {
        slug: true,
        destinationUrl: true,
        createdAt: true,
        automation: { select: { name: true } },
        _count: { select: { clicks: true } },
      },
    }),
  ]);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Nudge1";
  workbook.created = new Date();

  addSheet(
    workbook,
    "Campaigns",
    [
      { header: "Name", key: "name", width: 28 },
      { header: "Goal", key: "goal", width: 30 },
      { header: "Status", key: "status", width: 10 },
      { header: "Keywords", key: "keywords", width: 24 },
      { header: "DM Message", key: "dmMessage", width: 40 },
      { header: "Public Reply", key: "publicReply", width: 12 },
      { header: "Created", key: "createdAt", width: 14 },
    ],
    automations.map((a) => ({
      name: a.name,
      goal: a.goal ?? "",
      status: a.isActive ? "Active" : "Paused",
      keywords: a.keywords.join(", "),
      dmMessage: a.dmMessage,
      publicReply: a.publicReplyEnabled ? "Yes" : "No",
      createdAt: a.createdAt.toISOString().slice(0, 10),
    }))
  );

  addSheet(
    workbook,
    "DM Logs",
    [
      { header: "Commenter", key: "commenter", width: 22 },
      { header: "Comment", key: "comment", width: 30 },
      { header: "Matched Keyword", key: "keyword", width: 16 },
      { header: "Status", key: "status", width: 14 },
      { header: "Sent At", key: "sentAt", width: 20 },
      { header: "Error", key: "error", width: 30 },
      { header: "Created", key: "createdAt", width: 20 },
    ],
    dmLogs.map((log) => ({
      commenter: log.commenterName ?? "",
      comment: log.commentText,
      keyword: log.matchedKeyword ?? "",
      status: log.status,
      sentAt: log.dmSentAt ? log.dmSentAt.toISOString() : "",
      error: log.errorMessage ?? "",
      createdAt: log.createdAt.toISOString(),
    }))
  );

  addSheet(
    workbook,
    "Tracked Links",
    [
      { header: "Campaign", key: "campaign", width: 28 },
      { header: "Slug", key: "slug", width: 16 },
      { header: "Destination", key: "destination", width: 40 },
      { header: "Total Clicks", key: "clicks", width: 12 },
      { header: "Created", key: "createdAt", width: 14 },
    ],
    trackedLinks.map((link) => ({
      campaign: link.automation.name,
      slug: link.slug,
      destination: link.destinationUrl,
      clicks: link._count.clicks,
      createdAt: link.createdAt.toISOString().slice(0, 10),
    }))
  );

  const buffer = await workbook.xlsx.writeBuffer();

  return new NextResponse(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="nudge1-data-export.xlsx"`,
    },
  });
}
