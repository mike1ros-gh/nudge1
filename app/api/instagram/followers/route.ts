import { NextRequest, NextResponse } from "next/server";
import { getCurrentWorkspaceId } from "@/lib/auth";
import { getWorkspaceInstagramAccount } from "@/lib/instagram-accounts";
import { getFollowerGrowth, getUserInfo } from "@/lib/meta/client";
import { decryptToken } from "@/lib/meta/oauth";
import { prisma } from "@/lib/db/client";
import { DEFAULT_UTC_OFFSET_MINUTES, dayStart, formatDateKey } from "@/lib/utils/timezone";

export const dynamic = "force-dynamic";

// Current follower count (live) plus today/yesterday/7-day-average gain,
// sourced from Instagram's own account-level insights (a daily gain metric,
// not a running total — see lib/meta/client.ts#getFollowerGrowth). Today's
// and yesterday's values can read low for a while after the fact since Meta
// takes up to ~48h to fully settle a day's number; the 7-day average is
// computed over the 7 complete days before yesterday so it isn't skewed by
// that lag.
export async function GET(request: NextRequest) {
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const account = await getWorkspaceInstagramAccount(
    workspaceId,
    request.nextUrl.searchParams.get("instagramAccountId")
  );
  if (!account || !account.accessToken) {
    return NextResponse.json({ success: true, data: null });
  }

  try {
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { utcOffsetMinutes: true },
    });
    const utcOffsetMinutes = workspace?.utcOffsetMinutes ?? DEFAULT_UTC_OFFSET_MINUTES;

    const token = decryptToken(account.accessToken);
    const [profile, growth] = await Promise.all([
      getUserInfo(token),
      getFollowerGrowth(token, account.instagramId, 14, utcOffsetMinutes),
    ]);

    const byDate = new Map(growth.map((d) => [d.date, d.gained]));
    const now = new Date();
    const todayDate = formatDateKey(now, utcOffsetMinutes);
    const yesterdayDate = formatDateKey(dayStart(now, utcOffsetMinutes, 1), utcOffsetMinutes);

    let sevenDaySum = 0;
    for (let i = 1; i <= 7; i++) {
      const date = formatDateKey(dayStart(now, utcOffsetMinutes, i), utcOffsetMinutes);
      sevenDaySum += byDate.get(date) ?? 0;
    }

    return NextResponse.json({
      success: true,
      data: {
        current: profile.followers_count ?? null,
        today: byDate.get(todayDate) ?? 0,
        yesterday: byDate.get(yesterdayDate) ?? 0,
        sevenDayAvg: Number((sevenDaySum / 7).toFixed(1)),
      },
    });
  } catch (err) {
    console.error("[Instagram Followers] Error:", err);
    return NextResponse.json({ success: true, data: null });
  }
}
