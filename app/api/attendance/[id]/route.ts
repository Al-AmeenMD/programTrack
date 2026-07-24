import { AttendanceStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { ApiError, handleApiError } from "../../../../lib/api";
import { getFacilitatorProgramIds, requireAuth } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";
import { updateAttendanceRecordSchema } from "../../../../lib/validation";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuth(req);
    const { id: attendanceId } = await context.params;

    const record = await prisma.attendanceRecord.findUnique({
      where: { id: attendanceId },
      include: {
        session: {
          select: { id: true, program_id: true },
        },
      },
    });

    if (!record) {
      return NextResponse.json({ error: "Attendance record not found" }, { status: 404 });
    }

    if (user.role === "facilitator") {
      const assignedProgramIds = await getFacilitatorProgramIds(user.id);
      if (!assignedProgramIds.includes(record.session.program_id)) {
        throw new ApiError("Forbidden: attendance record not in your assigned programs", 403);
      }
    }

    const body = updateAttendanceRecordSchema.parse(await req.json());

    const updatedRecord = await prisma.attendanceRecord.update({
      where: { id: attendanceId },
      data: {
        status: body.status as AttendanceStatus,
        marked_at: new Date(),
        marked_by: user.id,
      },
    });

    return NextResponse.json({ data: updatedRecord });
  } catch (error) {
    return handleApiError(error);
  }
}
