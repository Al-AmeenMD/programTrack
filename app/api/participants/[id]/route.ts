import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { ApiError, handleApiError, parseDate } from "../../../../lib/api";
import { getFacilitatorProgramIds, requireAuth } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";
import { updateParticipantSchema } from "../../../../lib/validation";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

async function checkFacilitatorParticipantAccess(
  staffUserId: string,
  participantId: string
) {
  const assignedProgramIds = await getFacilitatorProgramIds(staffUserId);

  const enrollment = await prisma.enrollment.findFirst({
    where: {
      participant_id: participantId,
      program_id: { in: assignedProgramIds },
    },
  });

  if (!enrollment) {
    throw new ApiError("Forbidden: participant not in your assigned programs", 403);
  }

  return assignedProgramIds;
}

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuth(req);
    const { id } = await context.params;

    let assignedProgramIds: string[] | null = null;
    if (user.role === "facilitator") {
      assignedProgramIds = await checkFacilitatorParticipantAccess(user.id, id);
    }

    const participant = await prisma.participant.findUnique({
      where: { id },
      include: {
        enrollments: {
          where: assignedProgramIds
            ? { program_id: { in: assignedProgramIds } }
            : undefined,
          orderBy: { enrolled_at: "desc" },
          include: {
            program: true,
          },
        },
      },
    });

    if (!participant) {
      return NextResponse.json({ error: "Participant not found" }, { status: 404 });
    }

    return NextResponse.json({ data: participant });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuth(req);
    const { id } = await context.params;

    if (user.role === "facilitator") {
      await checkFacilitatorParticipantAccess(user.id, id);
    }

    const body = updateParticipantSchema.parse(await req.json());

    const existing = await prisma.participant.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Participant not found" }, { status: 404 });
    }

    const firstName = body.first_name !== undefined ? body.first_name : existing.first_name;
    const middleName = body.middle_name !== undefined ? body.middle_name : existing.middle_name;
    const lastName = body.last_name !== undefined ? body.last_name : existing.last_name;
    const fullName = [firstName, middleName, lastName].filter(Boolean).join(" ");

    const participant = await prisma.participant.update({
      where: { id },
      data: {
        first_name: firstName,
        middle_name: middleName,
        last_name: lastName,
        full_name: fullName,
        ...(body.nin_number !== undefined && { nin_number: body.nin_number }),
        ...(body.qualification !== undefined && { qualification: body.qualification }),
        ...(body.email !== undefined && { email: body.email }),
        ...(body.phone !== undefined && { phone: body.phone }),
        ...(body.gender !== undefined && { gender: body.gender }),
        ...(body.date_of_birth !== undefined && {
          date_of_birth: parseDate(body.date_of_birth),
        }),
        ...(body.metadata !== undefined && {
          metadata: body.metadata as Prisma.InputJsonValue,
        }),
        ...(body.status !== undefined && { status: body.status }),
      },
    });

    return NextResponse.json({ data: participant });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuth(req);
    const { id } = await context.params;

    if (user.role === "facilitator") {
      await checkFacilitatorParticipantAccess(user.id, id);
    }

    const participant = await prisma.participant.update({
      where: { id },
      data: { status: "inactive" },
      include: {
        enrollments: true,
      },
    });

    return NextResponse.json({ data: participant });
  } catch (error) {
    return handleApiError(error);
  }
}
