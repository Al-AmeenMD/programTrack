import { NextRequest, NextResponse } from "next/server";
import { handleApiError, parseDate } from "../../../../lib/api";
import { prisma } from "../../../../lib/prisma";
import { updateProgramSchema } from "../../../../lib/validation";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    const program = await prisma.program.findUnique({
      where: { id },
      include: {
        _count: {
          select: { enrollments: true },
        },
      },
    });

    if (!program) {
      return NextResponse.json({ error: "Program not found" }, { status: 404 });
    }

    return NextResponse.json({ data: program });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = updateProgramSchema.parse(await req.json());

    const program = await prisma.program.update({
      where: { id },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.start_date !== undefined && {
          start_date: parseDate(body.start_date),
        }),
        ...(body.end_date !== undefined && { end_date: parseDate(body.end_date) }),
        ...(body.status !== undefined && { status: body.status }),
        ...(body.created_by !== undefined && { created_by: body.created_by }),
      },
    });

    return NextResponse.json({ data: program });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    const program = await prisma.program.update({
      where: { id },
      data: { status: "cancelled" },
    });

    return NextResponse.json({ data: program });
  } catch (error) {
    return handleApiError(error);
  }
}
