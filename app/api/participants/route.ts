import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import {
  handleApiError,
  paginatedResponse,
  paginationFromUrl,
  parseDate,
} from "../../../lib/api";
import { createOrEnrollParticipant } from "../../../lib/participants/createOrEnrollParticipant";
import { prisma } from "../../../lib/prisma";
import { createParticipantSchema } from "../../../lib/validation";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const { page, pageSize, skip, take } = paginationFromUrl(req.url);
    const search = searchParams.get("search")?.trim();
    const status = searchParams.get("status")?.trim();

    const where: Prisma.ParticipantWhereInput = {
      status: status === "inactive" ? "inactive" : "active",
    };

    if (search) {
      where.OR = [
        { full_name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { phone: { contains: search, mode: "insensitive" } },
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
    const body = createParticipantSchema.parse(await req.json());

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
