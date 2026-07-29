import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import {
  ApiError,
  handleApiError,
  paginatedResponse,
  paginationFromUrl,
  parseDate,
} from "@/lib/api";
import { getFacilitatorProgramIds, requireAuth } from "@/lib/auth";
import { createOrEnrollParticipant } from "@/lib/participants/createOrEnrollParticipant";
import { prisma } from "@/lib/prisma";
import { createParticipantSchema } from "@/lib/validation";

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req);

    const { searchParams } = new URL(req.url);
    const { page, pageSize, skip, take } = paginationFromUrl(req.url);
    const search = searchParams.get("search")?.trim();
    const status = searchParams.get("status")?.trim();
    const gender = searchParams.get("gender")?.trim();
    const programId = searchParams.get("program_id")?.trim();
    const courseId = searchParams.get("course_id")?.trim();

    const where: Prisma.ParticipantWhereInput = {};

    // Status filter
    if (status === "inactive") {
      where.status = "inactive";
    } else if (status === "all") {
      // no status constraint
    } else {
      where.status = "active";
    }

    // Gender filter
    if (gender && gender !== "all") {
      if (gender === "unspecified") {
        where.OR = [{ gender: null }, { gender: "" }];
      } else {
        where.gender = { equals: gender, mode: "insensitive" };
      }
    }

    // Enrollment / Program / Course filter
    const enrollmentFilter: Prisma.EnrollmentWhereInput = {};
    if (programId) {
      enrollmentFilter.program_id = programId;
    }
    if (courseId) {
      enrollmentFilter.course_id = courseId;
    }

    if (user.role === "facilitator") {
      const assignedProgramIds = await getFacilitatorProgramIds(user.id);
      if (programId) {
        if (!assignedProgramIds.includes(programId)) {
          // Facilitator not assigned to this program, match impossible UUID
          enrollmentFilter.program_id = "00000000-0000-0000-0000-000000000000";
        }
      } else {
        enrollmentFilter.program_id = { in: assignedProgramIds };
      }
    }

    if (Object.keys(enrollmentFilter).length > 0) {
      where.enrollments = {
        some: enrollmentFilter,
      };
    }

    // Text search
    if (search) {
      const searchCondition: Prisma.ParticipantWhereInput = {
        OR: [
          { first_name: { contains: search, mode: "insensitive" } },
          { middle_name: { contains: search, mode: "insensitive" } },
          { last_name: { contains: search, mode: "insensitive" } },
          { full_name: { contains: search, mode: "insensitive" } },
          { nin_number: { contains: search, mode: "insensitive" } },
          { qualification: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
          { phone: { contains: search, mode: "insensitive" } },
        ],
      };

      if (where.OR) {
        const existingOr = where.OR;
        delete where.OR;
        where.AND = [{ OR: existingOr }, searchCondition];
      } else {
        where.AND = [searchCondition];
      }
    }

    const [participants, total] = await Promise.all([
      prisma.participant.findMany({
        where,
        skip,
        take,
        orderBy: { created_at: "desc" },
        include: {
          _count: {
            select: { enrollments: true },
          },
        },
      }),
      prisma.participant.count({ where }),
    ]);

    const formattedParticipants = participants.map((p) => ({
      ...p,
      enrollment_count: p._count.enrollments,
    }));

    return paginatedResponse({ data: formattedParticipants, total, page, pageSize });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    const body = createParticipantSchema.parse(await req.json());

    if (user.role === "facilitator") {
      if (!body.program_id) {
        throw new ApiError(
          "Facilitators can only create participants tied to an assigned program",
          403
        );
      }
      const assignedProgramIds = await getFacilitatorProgramIds(user.id);
      if (!assignedProgramIds.includes(body.program_id)) {
        throw new ApiError("Forbidden: program not assigned to facilitator", 403);
      }
    }

    if (body.program_id) {
      const result = await createOrEnrollParticipant(
        { ...body, metadata: body.metadata as Prisma.InputJsonValue },
        body.program_id,
        body.course_id
      );
      return NextResponse.json({ data: result }, { status: 201 });
    }

    const fullName = [body.first_name, body.middle_name, body.last_name].filter(Boolean).join(" ");
    const participant = await prisma.participant.create({
      data: {
        first_name: body.first_name,
        middle_name: body.middle_name ?? null,
        last_name: body.last_name,
        nin_number: body.nin_number,
        qualification: body.qualification ?? null,
        full_name: fullName,
        email: body.email ?? null,
        phone: body.phone ?? null,
        gender: body.gender ?? null,
        date_of_birth: parseDate(body.date_of_birth),
        metadata: body.metadata as Prisma.InputJsonValue,
      },
    });

    return NextResponse.json({ data: participant }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
