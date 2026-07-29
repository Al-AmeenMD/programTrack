import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { ApiError, handleApiError } from "../../../../lib/api";
import { getFacilitatorProgramIds, requireAuth } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";
import { updateEnrollmentSchema } from "../../../../lib/validation";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

async function checkFacilitatorEnrollmentAccess(
  staffUserId: string,
  enrollmentId: string
) {
  const enrollment = await prisma.enrollment.findUnique({
    where: { id: enrollmentId },
    select: { program_id: true },
  });

  if (!enrollment) {
    throw new ApiError("Enrollment not found", 404);
  }

  const assignedProgramIds = await getFacilitatorProgramIds(staffUserId);
  if (!assignedProgramIds.includes(enrollment.program_id)) {
    throw new ApiError("Forbidden: enrollment not in your assigned programs", 403);
  }
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuth(req);
    const { id } = await context.params;

    if (user.role === "facilitator") {
      await checkFacilitatorEnrollmentAccess(user.id, id);
    }

    const body = updateEnrollmentSchema.parse(await req.json());

    const enrollment = await prisma.enrollment.update({
      where: { id },
      data: {
        ...(body.status !== undefined && { status: body.status }),
        ...(body.course_id !== undefined && {
          course_id: body.course_id ? body.course_id : null,
        }),
        ...(body.metadata !== undefined && {
          metadata: body.metadata as Prisma.InputJsonValue,
        }),
      },
      include: {
        participant: true,
        program: true,
        course: true,
      },
    });

    return NextResponse.json({ data: enrollment });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuth(req);
    const { id } = await context.params;

    if (user.role === "facilitator") {
      await checkFacilitatorEnrollmentAccess(user.id, id);
    }

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
