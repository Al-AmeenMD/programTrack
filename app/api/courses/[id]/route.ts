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
    const { id } = await context.params;

    const course = await prisma.course.findUnique({
      where: { id },
      include: {
        program: true,
        _count: {
          select: { enrollments: true },
        },
      },
    });

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    if (user.role === "facilitator") {
      const assignedProgramIds = await getFacilitatorProgramIds(user.id);
      if (!assignedProgramIds.includes(course.program_id)) {
        throw new ApiError("Forbidden: course program not assigned to facilitator", 403);
      }
    }

    return NextResponse.json({ data: course });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    await requireRole("admin", req);
    const { id } = await context.params;

    const existing = await prisma.course.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    const body = await req.json();
    const name = typeof body?.name === "string" ? body.name.trim() : "";

    if (!name) {
      throw new ApiError("Course name is required", 400);
    }

    const updated = await prisma.course.update({
      where: { id },
      data: { name },
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    await requireRole("admin", req);
    const { id } = await context.params;

    const existing = await prisma.course.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    await prisma.course.delete({
      where: { id },
    });

    return NextResponse.json({ data: { message: "Course deleted successfully" } });
  } catch (error) {
    return handleApiError(error);
  }
}
