import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import {
  ApiError,
  handleApiError,
  paginatedResponse,
  paginationFromUrl,
} from "../../../../../lib/api";
import { getFacilitatorProgramIds, requireAuth } from "../../../../../lib/auth";
import { prisma } from "../../../../../lib/prisma";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuth(req);
    const { id } = await context.params;

    if (user.role === "facilitator") {
      const assignedProgramIds = await getFacilitatorProgramIds(user.id);
      if (!assignedProgramIds.includes(id)) {
        throw new ApiError("Forbidden: program not assigned to facilitator", 403);
      }
    }

    const { searchParams } = new URL(req.url);
    const { page, pageSize, skip, take } = paginationFromUrl(req.url);
    const search = searchParams.get("search")?.trim();
    const status = searchParams.get("status")?.trim();
    const courseId = searchParams.get("course_id")?.trim();
    const allowedStatuses = ["registered", "active", "dropped", "completed"] as const;

    if (status && status !== "all" && !allowedStatuses.includes(status as (typeof allowedStatuses)[number])) {
      return NextResponse.json({ error: "Invalid status filter" }, { status: 400 });
    }

    const program = await prisma.program.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!program) {
      return NextResponse.json({ error: "Program not found" }, { status: 404 });
    }

    const where: Prisma.EnrollmentWhereInput = {
      program_id: id,
      ...(courseId ? { course_id: courseId } : {}),
      ...(status && status !== "all"
        ? { status: status as (typeof allowedStatuses)[number] }
        : status === "all"
        ? {}
        : { status: { not: "dropped" } }),
    };

    if (search) {
      where.participant = {
        OR: [
          { full_name: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
          { phone: { contains: search, mode: "insensitive" } },
        ],
      };
    }

    const [enrollments, total] = await Promise.all([
      prisma.enrollment.findMany({
        where,
        skip,
        take,
        orderBy: { enrolled_at: "desc" },
        include: {
          participant: true,
          program: true,
          course: true,
        },
      }),
      prisma.enrollment.count({ where }),
    ]);

    return paginatedResponse({ data: enrollments, total, page, pageSize });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuth(req);
    const { id: programId } = await context.params;

    if (user.role === "facilitator") {
      const assignedProgramIds = await getFacilitatorProgramIds(user.id);
      if (!assignedProgramIds.includes(programId)) {
        throw new ApiError("Forbidden: program not assigned to facilitator", 403);
      }
    }

    const body = await req.json();

    let firstName = body.first_name || "";
    let middleName = body.middle_name || null;
    let lastName = body.last_name || "";

    if (!firstName && body.full_name) {
      const parts = body.full_name.trim().split(/\s+/);
      firstName = parts[0] || "";
      lastName = parts.length > 1 ? parts.slice(1).join(" ") : "Participant";
    }

    if (!firstName) {
      return NextResponse.json({ error: "First name is required" }, { status: 400 });
    }

    const participantData = {
      first_name: firstName,
      middle_name: middleName,
      last_name: lastName || "Participant",
      email: body.email || null,
      phone: body.phone || null,
      gender: body.gender || null,
      date_of_birth: body.date_of_birth || null,
      nin_number: body.nin_number || undefined,
      qualification: body.qualification || null,
    };

    const { createOrEnrollParticipant } = await import("@/lib/participants/createOrEnrollParticipant");
    const result = await createOrEnrollParticipant(
      participantData,
      programId,
      body.course_id || null
    );

    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
