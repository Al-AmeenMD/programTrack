import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/api";
import { getFacilitatorProgramIds, requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req);

    let programWhere: any = {};
    let enrollmentWhere: any = {};

    if (user.role === "facilitator") {
      const assignedProgramIds = await getFacilitatorProgramIds(user.id);
      programWhere = { id: { in: assignedProgramIds } };
      enrollmentWhere = { program_id: { in: assignedProgramIds } };
    }

    // 1. Program Status Breakdown & Total Programs
    const [allPrograms, allEnrollments] = await Promise.all([
      prisma.program.findMany({
        where: programWhere,
        select: { id: true, name: true, status: true, created_at: true },
      }),
      prisma.enrollment.findMany({
        where: enrollmentWhere,
        select: {
          id: true,
          participant_id: true,
          program_id: true,
          status: true,
          created_at: true,
        },
      }),
    ]);

    const totalPrograms = allPrograms.length;

    const programStatusCounts = {
      upcoming: allPrograms.filter((p) => p.status === "upcoming").length,
      active: allPrograms.filter((p) => p.status === "active").length,
      completed: allPrograms.filter((p) => p.status === "completed").length,
      cancelled: allPrograms.filter((p) => p.status === "cancelled").length,
    };

    // 2. Active Participants (Distinct participants with at least 1 active enrollment)
    const activeParticipantIds = new Set(
      allEnrollments.filter((e) => e.status === "active").map((e) => e.participant_id)
    );
    const totalActiveParticipants = activeParticipantIds.size;

    // 3. Total Enrollments & Status Breakdown
    const totalEnrollments = allEnrollments.length;
    const statusCounts = {
      registered: allEnrollments.filter((e) => e.status === "registered").length,
      active: allEnrollments.filter((e) => e.status === "active").length,
      completed: allEnrollments.filter((e) => e.status === "completed").length,
      dropped: allEnrollments.filter((e) => e.status === "dropped").length,
    };

    // 4. Completion Rate & Dropout Rate
    const finishedCount = statusCounts.completed + statusCounts.dropped;
    const completionRate =
      finishedCount > 0
        ? Math.round((statusCounts.completed / finishedCount) * 1000) / 10
        : 0;
    const dropoutRate =
      finishedCount > 0
        ? Math.round((statusCounts.dropped / finishedCount) * 1000) / 10
        : 0;

    // 5. Enrollment Trend over time (grouped by Month for the last 6 months)
    const now = new Date();
    const monthlyTrendMap = new Map<string, number>();

    // Generate last 6 month keys (e.g. "Feb 2026", "Mar 2026", "Apr 2026", "May 2026", "Jun 2026", "Jul 2026")
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = d.toLocaleString("default", { month: "short", year: "numeric" });
      monthlyTrendMap.set(label, 0);
    }

    allEnrollments.forEach((e) => {
      const d = new Date(e.created_at);
      const label = d.toLocaleString("default", { month: "short", year: "numeric" });
      if (monthlyTrendMap.has(label)) {
        monthlyTrendMap.set(label, (monthlyTrendMap.get(label) || 0) + 1);
      }
    });

    const enrollmentTrend = Array.from(monthlyTrendMap.entries()).map(([label, count]) => ({
      period: label,
      count,
    }));

    return NextResponse.json({
      role: user.role,
      totalPrograms,
      programStatusCounts,
      totalActiveParticipants,
      totalEnrollments,
      statusCounts,
      completionRate,
      dropoutRate,
      enrollmentTrend,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
