import { NextRequest, NextResponse } from "next/server";
import { ApiError, handleApiError } from "../../../../../lib/api";
import { requireRole } from "../../../../../lib/auth";
import { prisma } from "../../../../../lib/prisma";
import { assignStaffCourseSchema } from "../../../../../lib/validation";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    await requireRole("admin", req);
    const { id: staff_user_id } = await context.params;

    const body = assignStaffCourseSchema.parse(await req.json());

    // Find the program_staff entry
    const programStaff = await prisma.programStaff.findUnique({
      where: {
        staff_user_id_program_id: {
          staff_user_id,
          program_id: body.program_id,
        },
      },
    });

    if (!programStaff) {
      throw new ApiError(
        "Staff member must be assigned to the program before assigning specific courses",
        400
      );
    }

    // Verify course belongs to program
    const course = await prisma.course.findUnique({
      where: { id: body.course_id },
    });

    if (!course || course.program_id !== body.program_id) {
      throw new ApiError("Course does not belong to the specified program", 400);
    }

    const assignment = await prisma.facilitatorCourse.upsert({
      where: {
        program_staff_id_course_id: {
          program_staff_id: programStaff.id,
          course_id: body.course_id,
        },
      },
      update: {},
      create: {
        program_staff_id: programStaff.id,
        course_id: body.course_id,
      },
      include: {
        course: true,
      },
    });

    return NextResponse.json({ data: assignment }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    await requireRole("admin", req);
    const { id: staff_user_id } = await context.params;

    const { searchParams } = new URL(req.url);
    const program_id = searchParams.get("program_id");
    const course_id = searchParams.get("course_id");

    if (!program_id || !course_id) {
      throw new ApiError(
        "program_id and course_id query parameters are required",
        400
      );
    }

    const programStaff = await prisma.programStaff.findUnique({
      where: {
        staff_user_id_program_id: {
          staff_user_id,
          program_id,
        },
      },
    });

    if (programStaff) {
      await prisma.facilitatorCourse.deleteMany({
        where: {
          program_staff_id: programStaff.id,
          course_id,
        },
      });
    }

    return NextResponse.json({ data: { message: "Course unassigned successfully" } });
  } catch (error) {
    return handleApiError(error);
  }
}
