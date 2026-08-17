import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/client";
import {
  canManageWorkspace,
  getCurrentWorkspaceContext,
} from "@/lib/workspace-access";

const nameSchema = z.object({
  name: z.string().trim().min(1).max(100),
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
      { success: false, error: "Only owners and admins can rename the workspace" },
      { status: 403 }
    );
  }

  const parsed = nameSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Invalid name" },
      { status: 400 }
    );
  }

  await prisma.workspace.update({
    where: { id: context.workspaceId },
    data: { name: parsed.data.name },
  });

  return NextResponse.json({ success: true, data: { name: parsed.data.name } });
}
