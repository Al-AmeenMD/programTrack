import { AttendanceStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { ApiError, handleApiError } from "../../../../../lib/api";
import { getFacilitatorProgramIds, requireAuth } from "../../../../../lib/auth";
import { prisma } from "../../../../../lib/prisma";
import { markAttendanceSchema } from "../../../../../lib/validation";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(req: NextRequest, context: RouteContext) {
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

    const { searchParams } = new URL(req.url);
    const includeDropped = searchParams.get("include_dropped") === "true";

    const enrollmentStatusFilter = includeDropped
      ? {}
      : { status: { in: ["registered", "active", "completed"] } };

    const enrollments = await prisma.enrollment.findMany({
      where: {
        program_id: session.program_id,
        ...enrollmentStatusFilter,
      },
      include: {
        participant: {
          select: {
            id: true,
            full_name: true,
            email: true,
            phone: true,
          },
        },
      },
      orderBy: {
        created_at: "asc",
      },
    });

    const existingRecords = await prisma.attendanceRecord.findMany({
      where: {
        session_id: sessionId,
      },
    });

    const recordMap = new Map(existingRecords.map((r) => [r.enrollment_id, r]));

    const result = enrollments.map((e) => {
      const record = recordMap.get(e.id) || null;
      return {
        enrollment_id: e.id,
        enrollment_status: e.status,
        participant: e.participant,
        attendance_record: record
          ? {
              id: record.id,
              status: record.status,
              marked_at: record.marked_at,
              marked_by: record.marked_by,
            }
          : null,
      };
    });

    return NextResponse.json({ data: result });
  } catch (error) {
    return handleApiError(error);
  }
}

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

    const json = await req.json();
    const payload = Array.isArray(json) ? { records: json } : json;
    const body = markAttendanceSchema.parse(payload);

    const upsertedRecords = [];
    for (const item of body.records) {
      const record = await prisma.attendanceRecord.upsert({
        where: {
          session_id_enrollment_id: {
            session_id: sessionId,
            enrollment_id: item.enrollment_id,
          },
        },
        update: {
          status: item.status as AttendanceStatus,
          marked_at: new Date(),
          marked_by: user.id,
        },
        create: {
          session_id: sessionId,
          enrollment_id: item.enrollment_id,
          status: item.status as AttendanceStatus,
          marked_by: user.id,
        },
      });
      upsertedRecords.push(record);
    }

    return NextResponse.json({ data: upsertedRecords });
  } catch (error) {
    return handleApiError(error);
  }
}
