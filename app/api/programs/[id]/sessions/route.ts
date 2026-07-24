import { NextRequest, NextResponse } from "next/server";
import { ApiError, handleApiError, parseDate } from "../../../../../lib/api";
import { getFacilitatorProgramIds, requireAuth } from "../../../../../lib/auth";
import { prisma } from "../../../../../lib/prisma";
import { createSessionSchema } from "../../../../../lib/validation";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuth(req);
    const { id: programId } = await context.params;

    if (user.role === "facilitator") {
      const assignedProgramIds = await getFacilitatorProgramIds(user.id);
      if (!assignedProgramIds.includes(programId)) {
        throw new ApiError("Forbidden: program not assigned to facilitator", 403);
      }
    }

    const { searchParams } = new URL(req.url);
    const includeInactive = searchParams.get("include_inactive") === "true";

    const sessions = await prisma.session.findMany({
      where: {
        program_id: programId,
        ...(includeInactive ? {} : { is_active: true }),
      },
      orderBy: {
        session_date: "asc",
      },
    });

    return NextResponse.json({ data: sessions });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuth(req);
    const { id: programId } = await context.params;

    if (user.role === "facilitator") {
      const assignedProgramIds = await getFacilitatorProgramIds(user.id);
      if (!assignedProgramIds.includes(programId)) {
        throw new ApiError("Forbidden: program not assigned to facilitator", 403);
      }
    }

    const program = await prisma.program.findUnique({
      where: { id: programId },
      select: { id: true },
    });

    if (!program) {
      return NextResponse.json({ error: "Program not found" }, { status: 404 });
    }

    const body = createSessionSchema.parse(await req.json());
    const sessionDate = parseDate(body.session_date);

    if (!sessionDate) {
      throw new ApiError("Valid session_date is required", 400);
    }

    const session = await prisma.session.create({
      data: {
        program_id: programId,
        title: body.title,
        session_date: sessionDate,
        is_active: true,
      },
    });

    return NextResponse.json({ data: session }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
