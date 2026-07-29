import { AttendanceStatus, EnrollmentStatus } from "@prisma/client";
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
      : { status: { in: [EnrollmentStatus.registered, EnrollmentStatus.active, EnrollmentStatus.completed] } };

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
        course: true,
      },
      orderBy: {
        created_at: "asc",
      },
    });

    const attendanceRecords = await prisma.attendanceRecord.findMany({
      where: { session_id: sessionId },
    });

    const attendanceMap = new Map(attendanceRecords.map((r) => [r.enrollment_id, r]));

    const result = enrollments.map((en) => {
      const record = attendanceMap.get(en.id);
      return {
        enrollment_id: en.id,
        participant: en.participant,
        course_id: en.course_id,
        course: en.course,
        enrollment_status: en.status,
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

    const body = await req.json();
    const { records } = markAttendanceSchema.parse(body);

    const upsertedRecords = [];

    for (const rec of records) {
      const result = await prisma.attendanceRecord.upsert({
        where: {
          session_id_enrollment_id: {
            session_id: sessionId,
            enrollment_id: rec.enrollment_id,
          },
        },
        update: {
          status: rec.status as AttendanceStatus,
          marked_at: new Date(),
          marked_by: user.id,
        },
        create: {
          session_id: sessionId,
          enrollment_id: rec.enrollment_id,
          status: rec.status as AttendanceStatus,
          marked_by: user.id,
        },
      });

      upsertedRecords.push(result);
    }

    return NextResponse.json({ data: upsertedRecords });
  } catch (error) {
    return handleApiError(error);
  }
}
