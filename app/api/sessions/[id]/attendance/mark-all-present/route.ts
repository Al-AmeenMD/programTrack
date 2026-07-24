import { AttendanceStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { ApiError, handleApiError } from "../../../../../../lib/api";
import { getFacilitatorProgramIds, requireAuth } from "../../../../../../lib/auth";
import { prisma } from "../../../../../../lib/prisma";
import { markAllPresentSchema } from "../../../../../../lib/validation";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuth(req);
    const { id: sessionId } = await context.params;

    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      select: { id: true, program_id: true },
    });

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    if (user.role === "facilitator") {
      const assignedProgramIds = await getFacilitatorProgramIds(user.id);
      if (!assignedProgramIds.includes(session.program_id)) {
        throw new ApiError("Forbidden: session not in your assigned programs", 403);
      }
    }

    let rawBody = {};
    try {
      const text = await req.text();
      if (text.trim()) {
        rawBody = JSON.parse(text);
      }
    } catch {
      rawBody = {};
    }

    const body = markAllPresentSchema.parse(rawBody);

    // Build map of excepted enrollment_id -> explicit status (or null if just skipped)
    const exceptMap = new Map<string, AttendanceStatus | null>();
    if (body.except) {
      for (const item of body.except) {
        if (typeof item === "string") {
          exceptMap.set(item, null);
        } else if (item && typeof item === "object") {
          exceptMap.set(item.enrollment_id, (item.status as AttendanceStatus) || null);
        }
      }
    }

    // Query active enrollments in the program
    const activeEnrollments = await prisma.enrollment.findMany({
      where: {
        program_id: session.program_id,
        status: { in: ["registered", "active", "completed"] },
      },
      select: { id: true },
    });

    const upsertedRecords = [];

    for (const enrollment of activeEnrollments) {
      const isExcepted = exceptMap.has(enrollment.id);
      const explicitExceptStatus = exceptMap.get(enrollment.id);

      if (isExcepted && !explicitExceptStatus) {
        // Skip marking this enrollment completely
        continue;
      }

      const targetStatus: AttendanceStatus = isExcepted && explicitExceptStatus
        ? explicitExceptStatus
        : "present";

      const record = await prisma.attendanceRecord.upsert({
        where: {
          session_id_enrollment_id: {
            session_id: sessionId,
            enrollment_id: enrollment.id,
          },
        },
        update: {
          status: targetStatus,
          marked_at: new Date(),
          marked_by: user.id,
        },
        create: {
          session_id: sessionId,
          enrollment_id: enrollment.id,
          status: targetStatus,
          marked_by: user.id,
        },
      });

      upsertedRecords.push(record);
    }

    return NextResponse.json({
      data: upsertedRecords,
      meta: {
        total_active_enrollments: activeEnrollments.length,
        marked_count: upsertedRecords.length,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
