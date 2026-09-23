import { NextRequest, NextResponse } from "next/server";
import { ApiError, handleApiError } from "../../../../../lib/api";
import { requireAuth, requireRole } from "../../../../../lib/auth";
import { prisma } from "../../../../../lib/prisma";
import { createCourseGroupSchema } from "../../../../../lib/validation";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    await requireAuth(req);
    const { id: courseId } = await context.params;

    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true, program_id: true },
    });

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    const groups = await prisma.courseGroup.findMany({
      where: { course_id: courseId },
      include: {
        _count: {
          select: {
            enrollments: true,
          },
        },
        facilitator_groups: {
          include: {
            program_staff: {
              include: {
                staff_user: {
                  select: {
                    id: true,
                    full_name: true,
                    email: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: {
        name: "asc",
      },
    });

    const data = groups.map((g) => ({
      id: g.id,
      course_id: g.course_id,
      name: g.name,
      created_at: g.created_at,
      participant_count: g._count.enrollments,
      facilitators: g.facilitator_groups.map((fg) => ({
        id: fg.program_staff.staff_user.id,
        full_name: fg.program_staff.staff_user.full_name,
        email: fg.program_staff.staff_user.email,
      })),
    }));

    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    await requireRole("admin", req);
    const { id: courseId } = await context.params;

    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true },
    });

    if (!course) {
      throw new ApiError("Course not found", 404);
    }

    const body = createCourseGroupSchema.parse(await req.json());
    const trimmedName = body.name.trim();

    // Check for duplicate group name within course
    const existing = await prisma.courseGroup.findFirst({
      where: {
        course_id: courseId,
        name: {
          equals: trimmedName,
          mode: "insensitive",
        },
      },
    });

    if (existing) {
      throw new ApiError(`A group named '${trimmedName}' already exists in this course`, 409);
    }

    const group = await prisma.courseGroup.create({
      data: {
        course_id: courseId,
        name: trimmedName,
      },
    });

    return NextResponse.json({ data: group }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
