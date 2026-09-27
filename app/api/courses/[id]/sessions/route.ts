import { NextRequest, NextResponse } from "next/server";
import { ApiError, handleApiError, parseDate } from "@/lib/api";
import { getFacilitatorCourseIds, requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createSessionSchema } from "@/lib/validation";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuth(req);
    const { id: courseId } = await context.params;

    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true, program_id: true },
    });

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    if (user.role === "facilitator") {
      const assignedCourseIds = await getFacilitatorCourseIds(user.id, course.program_id);
      if (!assignedCourseIds.includes(courseId)) {
        throw new ApiError("Forbidden: course not assigned to facilitator", 403);
      }
    }

    const { searchParams } = new URL(req.url);
    const includeInactive = searchParams.get("include_inactive") === "true";

    const sessions = await prisma.session.findMany({
      where: {
        course_id: courseId,
        ...(includeInactive ? {} : { is_active: true }),
      },
      orderBy: {
        session_date: "asc",
      },
      include: {
        course: { select: { id: true, name: true } },
        program: { select: { id: true, name: true } },
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
    const { id: courseId } = await context.params;

    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true, program_id: true },
    });

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    if (user.role === "facilitator") {
      const assignedCourseIds = await getFacilitatorCourseIds(user.id, course.program_id);
      if (!assignedCourseIds.includes(courseId)) {
        throw new ApiError("Forbidden: course not assigned to facilitator", 403);
      }
    }

    const body = createSessionSchema.parse(await req.json());
    const sessionDate = parseDate(body.session_date);

    if (!sessionDate) {
      throw new ApiError("Valid session_date is required", 400);
    }

    const session = await prisma.session.create({
      data: {
        program_id: course.program_id, // Derived server-side from course to avoid drift
        course_id: course.id,
        title: body.title,
        session_date: sessionDate,
        is_active: true,
      },
      include: {
        course: { select: { id: true, name: true } },
        program: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({ data: session }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
