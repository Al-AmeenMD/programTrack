import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "../../../../lib/api";
import { prisma } from "../../../../lib/prisma";
import { updateEnrollmentSchema } from "../../../../lib/validation";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = updateEnrollmentSchema.parse(await req.json());

    const enrollment = await prisma.enrollment.update({
      where: { id },
      data: {
        ...(body.status !== undefined && { status: body.status }),
        ...(body.metadata !== undefined && {
          metadata: body.metadata as Prisma.InputJsonValue,
        }),
      },
      include: {
        participant: true,
        program: true,
      },
    });

    return NextResponse.json({ data: enrollment });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    const enrollment = await prisma.enrollment.update({
      where: { id },
      data: { status: "dropped" },
      include: {
        participant: true,
        program: true,
      },
    });

    return NextResponse.json({ data: enrollment });
  } catch (error) {
    return handleApiError(error);
  }
}
