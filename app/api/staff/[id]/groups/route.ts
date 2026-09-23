import { NextRequest, NextResponse } from "next/server";
import { ApiError, handleApiError } from "../../../../../lib/api";
import { requireAuth, requireRole } from "../../../../../lib/auth";
import { prisma } from "../../../../../lib/prisma";
import { assignStaffGroupsSchema } from "../../../../../lib/validation";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    await requireAuth(req);
    const { id: staffUserId } = await context.params;

    const staff = await prisma.staffUser.findUnique({
      where: { id: staffUserId },
      select: { id: true, role: true },
    });

    if (!staff) {
      return NextResponse.json({ error: "Staff member not found" }, { status: 404 });
    }

    const assignments = await prisma.facilitatorGroup.findMany({
      where: {
        program_staff: {
          staff_user_id: staffUserId,
        },
      },
      include: {
        course_group: {
          include: {
            course: true,
          },
        },
        program_staff: {
          include: {
            program: true,
          },
        },
      },
    });

    const data = assignments.map((a) => ({
      id: a.id,
      program_staff_id: a.program_staff_id,
      program_id: a.program_staff.program_id,
      program_name: a.program_staff.program.name,
      course_id: a.course_group.course_id,
      course_name: a.course_group.course.name,
      group_id: a.course_group.id,
      group_name: a.course_group.name,
    }));

    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    await requireRole("admin", req);
    const { id: staffUserId } = await context.params;

    const body = assignStaffGroupsSchema.parse(await req.json());

    // 1. Verify program_staff entry exists
    const programStaff = await prisma.programStaff.findUnique({
      where: {
        staff_user_id_program_id: {
          staff_user_id: staffUserId,
          program_id: body.program_id,
        },
      },
    });

    if (!programStaff) {
      throw new ApiError(
        "Staff member must be assigned to the program before assigning specific groups",
        400
      );
    }

    // 2. Verify facilitator_courses entry exists (must be assigned to track first)
    const facilitatorCourse = await prisma.facilitatorCourse.findUnique({
      where: {
        program_staff_id_course_id: {
          program_staff_id: programStaff.id,
          course_id: body.course_id,
        },
      },
    });

    if (!facilitatorCourse) {
      throw new ApiError(
        "Staff member must be assigned to the course track before assigning specific groups",
        400
      );
    }

    // 3. Verify all group_ids belong to the course
    if (body.group_ids.length > 0) {
      const validGroups = await prisma.courseGroup.findMany({
        where: {
          id: { in: body.group_ids },
          course_id: body.course_id,
        },
      });

      if (validGroups.length !== body.group_ids.length) {
        throw new ApiError(
          "One or more group IDs do not belong to the specified course",
          400
        );
      }
    }

    // 4. Remove existing facilitator_groups for this course
    const courseGroups = await prisma.courseGroup.findMany({
      where: { course_id: body.course_id },
      select: { id: true },
    });
    const courseGroupIds = courseGroups.map((g) => g.id);

    if (courseGroupIds.length > 0) {
      await prisma.facilitatorGroup.deleteMany({
        where: {
          program_staff_id: programStaff.id,
          course_group_id: { in: courseGroupIds },
        },
      });
    }

    // 5. Insert newly assigned groups
    if (body.group_ids.length > 0) {
      await prisma.facilitatorGroup.createMany({
        data: body.group_ids.map((groupId) => ({
          program_staff_id: programStaff.id,
          course_group_id: groupId,
        })),
      });
    }

    const updatedGroups = await prisma.facilitatorGroup.findMany({
      where: {
        program_staff_id: programStaff.id,
        course_group_id: { in: courseGroupIds },
      },
      include: {
        course_group: true,
      },
    });

    return NextResponse.json({
      data: updatedGroups.map((g) => ({
        id: g.id,
        group_id: g.course_group_id,
        group_name: g.course_group.name,
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
