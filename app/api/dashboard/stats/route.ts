import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, getFacilitatorProgramIds } from "@/lib/auth";
import { handleApiError } from "@/lib/api";

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    const { searchParams } = new URL(req.url);
    const trendPeriod = searchParams.get("trendPeriod") || "monthly";

    // Build role-based scoping filters
    let programWhere = {};
    let enrollmentWhere = {};

    if (user.role === "facilitator") {
      const assignedProgramIds = await getFacilitatorProgramIds(user.id);
      programWhere = { id: { in: assignedProgramIds } };
      enrollmentWhere = { program_id: { in: assignedProgramIds } };
    }

    // 1. Fetch programs and enrollments in parallel
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

    // 5. Enrollment Trend Aggregation Server-Side
    const now = new Date();
    const trendMap = new Map<string, number>();

    if (trendPeriod === "quarterly") {
      // Last 8 Quarters (2 Years)
      const currentYear = now.getFullYear();
      const currentQuarter = Math.floor(now.getMonth() / 3) + 1; // 1-4

      for (let i = 7; i >= 0; i--) {
        let q = currentQuarter - (i % 4);
        let y = currentYear - Math.floor(i / 4);
        if (q <= 0) {
          q += 4;
          y -= 1;
        }
        const label = `Q${q} ${y}`;
        trendMap.set(label, 0);
      }

      allEnrollments.forEach((e) => {
        const d = new Date(e.created_at);
        const q = Math.floor(d.getMonth() / 3) + 1;
        const y = d.getFullYear();
        const label = `Q${q} ${y}`;
        if (trendMap.has(label)) {
          trendMap.set(label, (trendMap.get(label) || 0) + 1);
        }
      });
    } else if (trendPeriod === "biannual") {
      // Last 4 Half-Years (2 Years)
      const currentYear = now.getFullYear();
      const currentHalf = now.getMonth() < 6 ? 1 : 2;

      for (let i = 3; i >= 0; i--) {
        let h = currentHalf - (i % 2);
        let y = currentYear - Math.floor(i / 2);
        if (h <= 0) {
          h += 2;
          y -= 1;
        }
        const label = `H${h} ${y}`;
        trendMap.set(label, 0);
      }

      allEnrollments.forEach((e) => {
        const d = new Date(e.created_at);
        const h = d.getMonth() < 6 ? 1 : 2;
        const y = d.getFullYear();
        const label = `H${h} ${y}`;
        if (trendMap.has(label)) {
          trendMap.set(label, (trendMap.get(label) || 0) + 1);
        }
      });
    } else if (trendPeriod === "annual") {
      // Last 5 Calendar Years
      const currentYear = now.getFullYear();
      for (let i = 4; i >= 0; i--) {
        const label = `${currentYear - i}`;
        trendMap.set(label, 0);
      }

      allEnrollments.forEach((e) => {
        const d = new Date(e.created_at);
        const label = `${d.getFullYear()}`;
        if (trendMap.has(label)) {
          trendMap.set(label, (trendMap.get(label) || 0) + 1);
        }
      });
    } else {
      // Default: Monthly (Current Calendar Year: Jan - Dec)
      const currentYear = now.getFullYear();
      for (let monthIdx = 0; monthIdx < 12; monthIdx++) {
        const d = new Date(currentYear, monthIdx, 1);
        const label = d.toLocaleString("default", { month: "short", year: "numeric" });
        trendMap.set(label, 0);
      }

      allEnrollments.forEach((e) => {
        const d = new Date(e.created_at);
        const label = d.toLocaleString("default", { month: "short", year: "numeric" });
        if (trendMap.has(label)) {
          trendMap.set(label, (trendMap.get(label) || 0) + 1);
        }
      });
    }

    const enrollmentTrend = Array.from(trendMap.entries()).map(([label, count]) => ({
      period: label,
      count,
    }));

    const totalTrendCount = enrollmentTrend.reduce((acc, curr) => acc + curr.count, 0);

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
      trendPeriod,
      totalTrendCount,
      hasEnoughData: totalTrendCount > 0,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
