import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/api";
import { getFacilitatorProgramIds, requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(req: NextRequest, { params }: RouteContext) {
  try {
    const user = await requireAuth(req);
    const { id: programId } = await params;

    // RBAC Check
    if (user.role === "facilitator") {
      const assignedProgramIds = await getFacilitatorProgramIds(user.id);
      if (!assignedProgramIds.includes(programId)) {
        return NextResponse.json(
          { error: "Forbidden: You are not assigned to this program" },
          { status: 403 }
        );
      }
    }

    const program = await prisma.program.findUnique({
      where: { id: programId },
      include: {
        courses: {
          select: { id: true, name: true },
        },
      },
    });

    if (!program) {
      return NextResponse.json({ error: "Program not found" }, { status: 404 });
    }

    const enrollments = await prisma.enrollment.findMany({
      where: { program_id: programId },
      include: {
        participant: {
          select: { id: true, full_name: true, email: true, gender: true },
        },
        course: {
          select: { id: true, name: true },
        },
      },
    });

    // 1. Status Breakdown
    const totalEnrollments = enrollments.length;
    const statusCounts = {
      registered: enrollments.filter((e) => e.status === "registered").length,
      active: enrollments.filter((e) => e.status === "active").length,
      completed: enrollments.filter((e) => e.status === "completed").length,
      dropped: enrollments.filter((e) => e.status === "dropped").length,
    };

    // 2. Funnel Data
    const funnel = {
      totalRegistered: totalEnrollments,
      currentlyActive: statusCounts.active,
      completed: statusCounts.completed,
      dropped: statusCounts.dropped,
      completionRate:
        statusCounts.completed + statusCounts.dropped > 0
          ? Math.round(
              (statusCounts.completed / (statusCounts.completed + statusCounts.dropped)) * 1000
            ) / 10
          : 0,
    };

    // 3. Course Breakdown
    const courseMap = new Map<string, { id: string; name: string; count: number }>();
    program.courses.forEach((c) => {
      courseMap.set(c.id, { id: c.id, name: c.name, count: 0 });
    });

    let unassignedCourseCount = 0;

    enrollments.forEach((e) => {
      if (e.course_id && courseMap.has(e.course_id)) {
        const item = courseMap.get(e.course_id)!;
        item.count += 1;
      } else {
        unassignedCourseCount += 1;
      }
    });

    const courseBreakdown = Array.from(courseMap.values());
    if (unassignedCourseCount > 0) {
      courseBreakdown.push({ id: "unassigned", name: "General / Unassigned", count: unassignedCourseCount });
    }

    // 4. Demographic Breakdown (Gender)
    const genderCounts = {
      male: 0,
      female: 0,
      other: 0,
      unspecified: 0,
    };

    enrollments.forEach((e) => {
      const g = (e.participant.gender || "").toLowerCase().trim();
      if (g === "male" || g === "m") {
        genderCounts.male += 1;
      } else if (g === "female" || g === "f") {
        genderCounts.female += 1;
      } else if (g === "other") {
        genderCounts.other += 1;
      } else {
        genderCounts.unspecified += 1;
      }
    });

    return NextResponse.json({
      program: {
        id: program.id,
        name: program.name,
        description: program.description,
        status: program.status,
        start_date: program.start_date,
        end_date: program.end_date,
      },
      totalEnrollments,
      statusCounts,
      funnel,
      courseBreakdown,
      genderCounts,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
