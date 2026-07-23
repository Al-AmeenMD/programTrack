import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { handleApiError, parseDate } from "../../../../lib/api";
import { prisma } from "../../../../lib/prisma";
import { updateParticipantSchema } from "../../../../lib/validation";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    const participant = await prisma.participant.findUnique({
      where: { id },
      include: {
        enrollments: {
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
    const { id } = await context.params;
    const body = updateParticipantSchema.parse(await req.json());

    const participant = await prisma.participant.update({
      where: { id },
      data: {
        ...(body.full_name !== undefined && { full_name: body.full_name }),
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

export async function DELETE(_req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

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
