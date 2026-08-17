import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/client";
import {
  canManageWorkspace,
  getCurrentWorkspaceContext,
} from "@/lib/workspace-access";

// -12:00 to +14:00, the practical range of real-world UTC offsets.
const timezoneSchema = z.object({
  utcOffsetMinutes: z.number().int().min(-720).max(840),
});

export async function PATCH(request: NextRequest) {
  const context = await getCurrentWorkspaceContext();
  if (!context) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }
  if (!canManageWorkspace(context.role)) {
    return NextResponse.json(
      { success: false, error: "Only owners and admins can change the timezone" },
      { status: 403 }
    );
  }

  const parsed = timezoneSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Invalid timezone" },
      { status: 400 }
    );
  }

  await prisma.workspace.update({
    where: { id: context.workspaceId },
    data: { utcOffsetMinutes: parsed.data.utcOffsetMinutes },
  });

  return NextResponse.json({
    success: true,
    data: { utcOffsetMinutes: parsed.data.utcOffsetMinutes },
  });
}
