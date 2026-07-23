import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "../../../../lib/api";
import { hashPassword, requireRole } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";
import { updateStaffSchema } from "../../../../lib/validation";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    await requireRole("admin", req);
    const { id } = await context.params;

    const body = updateStaffSchema.parse(await req.json());

    const staffUser = await prisma.staffUser.update({
      where: { id },
      data: {
        ...(body.full_name !== undefined && { full_name: body.full_name }),
        ...(body.role !== undefined && { role: body.role }),
        ...(body.password !== undefined && {
          password_hash: hashPassword(body.password),
        }),
      },
      select: {
        id: true,
        full_name: true,
        email: true,
        role: true,
        created_at: true,
        updated_at: true,
      },
    });

    return NextResponse.json({ data: staffUser });
  } catch (error) {
    return handleApiError(error);
  }
}
