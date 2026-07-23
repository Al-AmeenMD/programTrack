import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import {
  ApiError,
  handleApiError,
  paginatedResponse,
  paginationFromUrl,
  parseDate,
} from "../../../lib/api";
import { getFacilitatorProgramIds, requireAuth } from "../../../lib/auth";
import { createOrEnrollParticipant } from "../../../lib/participants/createOrEnrollParticipant";
import { prisma } from "../../../lib/prisma";
import { createParticipantSchema } from "../../../lib/validation";

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req);

    const { searchParams } = new URL(req.url);
    const { page, pageSize, skip, take } = paginationFromUrl(req.url);
    const search = searchParams.get("search")?.trim();
    const status = searchParams.get("status")?.trim();

    const where: Prisma.ParticipantWhereInput = {
      status: status === "inactive" ? "inactive" : "active",
    };

    if (user.role === "facilitator") {
      const assignedProgramIds = await getFacilitatorProgramIds(user.id);
      where.enrollments = {
        some: {
          program_id: { in: assignedProgramIds },
        },
      };
    }

    if (search) {
      where.AND = [
        {
          OR: [
            { full_name: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
            { phone: { contains: search, mode: "insensitive" } },
          ],
        },
      ];
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

    return paginatedResponse({ data: participants, total, page, pageSize });
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
        body.program_id
      );
      return NextResponse.json({ data: result }, { status: 201 });
    }

    const participant = await prisma.participant.create({
      data: {
        full_name: body.full_name,
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
