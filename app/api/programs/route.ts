import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import {
  handleApiError,
  paginatedResponse,
  paginationFromUrl,
  parseDate,
} from "../../../lib/api";
import { getFacilitatorProgramIds, requireAuth, requireRole } from "../../../lib/auth";
import { prisma } from "../../../lib/prisma";
import { createProgramSchema } from "../../../lib/validation";

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req);

    const { searchParams } = new URL(req.url);
    const { page, pageSize, skip, take } = paginationFromUrl(req.url);
    const search = searchParams.get("search")?.trim();
    const status = searchParams.get("status")?.trim();
    const allowedStatuses = ["upcoming", "active", "completed", "cancelled"] as const;

    if (status && !allowedStatuses.includes(status as (typeof allowedStatuses)[number])) {
      return NextResponse.json({ error: "Invalid status filter" }, { status: 400 });
    }

    const where: Prisma.ProgramWhereInput = status
      ? { status: status as (typeof allowedStatuses)[number] }
      : { status: { not: "cancelled" } };

    if (user.role === "facilitator") {
      const assignedProgramIds = await getFacilitatorProgramIds(user.id);
      where.id = { in: assignedProgramIds };
    }

    if (search) {
      where.name = { contains: search, mode: "insensitive" };
    }

    const [programs, total] = await Promise.all([
      prisma.program.findMany({
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
      prisma.program.count({ where }),
    ]);

    return paginatedResponse({ data: programs, total, page, pageSize });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireRole("admin", req);
    const body = createProgramSchema.parse(await req.json());

    const program = await prisma.program.create({
      data: {
        name: body.name,
        description: body.description ?? null,
        start_date: parseDate(body.start_date),
        end_date: parseDate(body.end_date),
        status: body.status,
        created_by: body.created_by ?? null,
      },
    });

    return NextResponse.json({ data: program }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
