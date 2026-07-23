import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import {
  handleApiError,
  paginatedResponse,
  paginationFromUrl,
} from "../../../../../lib/api";
import { prisma } from "../../../../../lib/prisma";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { searchParams } = new URL(req.url);
    const { page, pageSize, skip, take } = paginationFromUrl(req.url);
    const search = searchParams.get("search")?.trim();
    const status = searchParams.get("status")?.trim();
    const allowedStatuses = ["registered", "active", "dropped", "completed"] as const;

    if (status && !allowedStatuses.includes(status as (typeof allowedStatuses)[number])) {
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
      ...(status
        ? { status: status as (typeof allowedStatuses)[number] }
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
        },
      }),
      prisma.enrollment.count({ where }),
    ]);

    return paginatedResponse({ data: enrollments, total, page, pageSize });
  } catch (error) {
    return handleApiError(error);
  }
}
