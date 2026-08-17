import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/client";
import {
  canManageWorkspace,
  getCurrentWorkspaceContext,
} from "@/lib/workspace-access";

const alertsSchema = z.object({
  alertsEnabled: z.boolean(),
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
      { success: false, error: "Only owners and admins can change alert settings" },
      { status: 403 }
    );
  }

  const parsed = alertsSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Invalid value" },
      { status: 400 }
    );
  }

  await prisma.workspace.update({
    where: { id: context.workspaceId },
    data: { alertsEnabled: parsed.data.alertsEnabled },
  });

  return NextResponse.json({
    success: true,
    data: { alertsEnabled: parsed.data.alertsEnabled },
  });
}
