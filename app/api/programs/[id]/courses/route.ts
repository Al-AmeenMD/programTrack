import { NextRequest, NextResponse } from "next/server";
import { ApiError, handleApiError } from "@/lib/api";
import { getFacilitatorProgramIds, requireAuth, requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuth(req);
    const { id: programId } = await context.params;

    const program = await prisma.program.findUnique({
      where: { id: programId },
      select: { id: true },
    });

    if (!program) {
      return NextResponse.json({ error: "Program not found" }, { status: 404 });
    }

    if (user.role === "facilitator") {
      const assignedProgramIds = await getFacilitatorProgramIds(user.id);
      if (!assignedProgramIds.includes(programId)) {
        throw new ApiError("Forbidden: program not in your assigned list", 403);
      }
    }

    const courses = await prisma.course.findMany({
      where: { program_id: programId },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ data: courses });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    await requireRole("admin", req);
    const { id: programId } = await context.params;

    const program = await prisma.program.findUnique({
      where: { id: programId },
      select: { id: true },
    });

    if (!program) {
      return NextResponse.json({ error: "Program not found" }, { status: 404 });
    }

    const body = await req.json();
    const name = typeof body?.name === "string" ? body.name.trim() : "";

    if (!name) {
      throw new ApiError("Course name is required", 400);
    }

    const course = await prisma.course.create({
      data: {
        program_id: programId,
        name,
      },
    });

    return NextResponse.json({ data: course }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
