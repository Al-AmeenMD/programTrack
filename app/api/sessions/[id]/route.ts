import { NextRequest, NextResponse } from "next/server";
import { ApiError, handleApiError, parseDate } from "../../../../lib/api";
import { getFacilitatorProgramIds, requireAuth } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";
import { updateSessionSchema } from "../../../../lib/validation";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuth(req);
    const { id: sessionId } = await context.params;

    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: { program: true },
    });

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    if (user.role === "facilitator") {
      const assignedProgramIds = await getFacilitatorProgramIds(user.id);
      if (!assignedProgramIds.includes(session.program_id)) {
        throw new ApiError("Forbidden: session not in your assigned programs", 403);
      }
    }

    return NextResponse.json({ data: session });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuth(req);
    const { id: sessionId } = await context.params;

    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      select: { id: true, program_id: true },
    });

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    if (user.role === "facilitator") {
      const assignedProgramIds = await getFacilitatorProgramIds(user.id);
      if (!assignedProgramIds.includes(session.program_id)) {
        throw new ApiError("Forbidden: session not in your assigned programs", 403);
      }
    }

    const body = updateSessionSchema.parse(await req.json());

    const updatedSession = await prisma.session.update({
      where: { id: sessionId },
      data: {
        ...(body.title !== undefined && { title: body.title }),
        ...(body.session_date !== undefined && {
          session_date: parseDate(body.session_date)!,
        }),
        ...(body.is_active !== undefined && { is_active: body.is_active }),
      },
    });

    return NextResponse.json({ data: updatedSession });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuth(req);
    const { id: sessionId } = await context.params;

    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      select: { id: true, program_id: true },
    });

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    if (user.role === "facilitator") {
      const assignedProgramIds = await getFacilitatorProgramIds(user.id);
      if (!assignedProgramIds.includes(session.program_id)) {
        throw new ApiError("Forbidden: session not in your assigned programs", 403);
      }
    }

    const softDeletedSession = await prisma.session.update({
      where: { id: sessionId },
      data: { is_active: false },
    });

    return NextResponse.json({ data: softDeletedSession });
  } catch (error) {
    return handleApiError(error);
  }
}
