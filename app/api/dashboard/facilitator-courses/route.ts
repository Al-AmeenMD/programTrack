import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req);

    if (user.role !== "facilitator") {
      return NextResponse.json({ data: [] });
    }

    const programStaffList = await prisma.programStaff.findMany({
      where: { staff_user_id: user.id },
      include: {
        program: {
          select: { id: true, name: true, status: true },
        },
        courses: {
          include: {
            course: {
              select: { id: true, name: true, created_at: true },
            },
          },
          orderBy: {
            course: { name: "asc" },
          },
        },
        facilitator_groups: {
          include: {
            course_group: {
              select: { id: true, course_id: true, name: true },
            },
          },
        },
      },
      orderBy: {
        program: { name: "asc" },
      },
    });

    const coursesData = [];

    for (const ps of programStaffList) {
      for (const fc of ps.courses) {
        const course = fc.course;

        // Total participants enrolled in this course (Y) - matches course detail page _count.enrollments
        const totalCourseParticipants = await prisma.enrollment.count({
          where: { course_id: course.id },
        });

        // Find facilitator's assigned groups for this specific course
        const assignedGroups = ps.facilitator_groups
          .filter((fg) => fg.course_group.course_id === course.id)
          .map((fg) => fg.course_group);

        let myParticipants = totalCourseParticipants;

        if (assignedGroups.length > 0) {
          const groupIds = assignedGroups.map((g) => g.id);
          // Total participants in facilitator's assigned groups (X)
          myParticipants = await prisma.enrollment.count({
            where: {
              course_id: course.id,
              course_group_id: { in: groupIds },
            },
          });
        }

        coursesData.push({
          course_id: course.id,
          course_name: course.name,
          program_id: ps.program.id,
          program_name: ps.program.name,
          program_status: ps.program.status,
          my_participants_count: myParticipants,
          total_participants_count: totalCourseParticipants,
          group_names: assignedGroups.map((g) => g.name),
          has_group_restriction: assignedGroups.length > 0,
        });
      }
    }

    return NextResponse.json({ data: coursesData });
  } catch (error) {
    return handleApiError(error);
  }
}
