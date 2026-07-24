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

    // Query pre-existing attendance records for this session
    const existingRecords = await prisma.attendanceRecord.findMany({
      where: { session_id: sessionId },
    });
    const existingRecordMap = new Map(existingRecords.map((r) => [r.enrollment_id, r]));

    // Query all active enrollments in the program
    const activeEnrollments = await prisma.enrollment.findMany({
      where: {
        program_id: session.program_id,
        status: { in: ["registered", "active", "completed"] },
      },
      select: { id: true },
    });

    const markedPresentRecords = [];
    const skippedAlreadyMarkedRecords = [];
    const exceptedRecords = [];

    for (const enrollment of activeEnrollments) {
      const enrollmentId = enrollment.id;
      const isExcepted = exceptMap.has(enrollmentId);
      const explicitExceptStatus = exceptMap.get(enrollmentId);
      const existingRecord = existingRecordMap.get(enrollmentId);

      if (isExcepted) {
        if (explicitExceptStatus) {
          // Upsert with explicit status provided in except array
          const record = await prisma.attendanceRecord.upsert({
            where: {
              session_id_enrollment_id: {
                session_id: sessionId,
                enrollment_id: enrollmentId,
              },
            },
            update: {
              status: explicitExceptStatus,
              marked_at: new Date(),
              marked_by: user.id,
            },
            create: {
              session_id: sessionId,
              enrollment_id: enrollmentId,
              status: explicitExceptStatus,
              marked_by: user.id,
            },
          });
          exceptedRecords.push(record);
        } else {
          // Excluded without explicit status change
          if (existingRecord) {
            exceptedRecords.push(existingRecord);
          } else {
            exceptedRecords.push({
              enrollment_id: enrollmentId,
              session_id: sessionId,
              status: null,
              reason: "Excepted from mark-all-present",
            });
          }
        }
      } else if (existingRecord) {
        // Participant ALREADY has an attendance record for this session -> DO NOT OVERWRITE!
        skippedAlreadyMarkedRecords.push(existingRecord);
      } else {
        // Participant is active, unmarked, and not excepted -> Mark as "present"
        const record = await prisma.attendanceRecord.upsert({
          where: {
            session_id_enrollment_id: {
              session_id: sessionId,
              enrollment_id: enrollmentId,
            },
          },
          update: {
            status: "present",
            marked_at: new Date(),
            marked_by: user.id,
          },
          create: {
            session_id: sessionId,
            enrollment_id: enrollmentId,
            status: "present",
            marked_by: user.id,
          },
        });
        markedPresentRecords.push(record);
      }
    }

    return NextResponse.json({
      data: {
        marked_present: markedPresentRecords,
        skipped_already_marked: skippedAlreadyMarkedRecords,
        excepted: exceptedRecords,
      },
      meta: {
        total_active_enrollments: activeEnrollments.length,
        marked_present_count: markedPresentRecords.length,
        skipped_already_marked_count: skippedAlreadyMarkedRecords.length,
        excepted_count: exceptedRecords.length,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
