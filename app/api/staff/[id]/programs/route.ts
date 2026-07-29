import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "../../../../../lib/api";
import { requireRole } from "../../../../../lib/auth";
import { prisma } from "../../../../../lib/prisma";
import { assignStaffProgramSchema } from "../../../../../lib/validation";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    await requireRole("admin", req);
    const { id: staff_user_id } = await context.params;

    const body = assignStaffProgramSchema.parse(await req.json());

    const staffUser = await prisma.staffUser.findUnique({
      where: { id: staff_user_id },
    });

    if (!staffUser) {
      return NextResponse.json({ error: "Staff user not found" }, { status: 404 });
    }

    const program = await prisma.program.findUnique({
      where: { id: body.program_id },
    });

    if (!program) {
      return NextResponse.json({ error: "Program not found" }, { status: 404 });
    }

    const programStaff = await prisma.programStaff.upsert({
      where: {
        staff_user_id_program_id: {
          staff_user_id,
          program_id: body.program_id,
        },
      },
      update: {},
      create: {
        staff_user_id,
        program_id: body.program_id,
      },
      include: {
        staff_user: {
          select: {
            id: true,
            full_name: true,
            email: true,
            role: true,
          },
        },
        program: true,
      },
    });

    return NextResponse.json({ data: programStaff }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    await requireRole("admin", req);
    const { id: staff_user_id } = await context.params;

    const { searchParams } = new URL(req.url);
    const program_id = searchParams.get("program_id");

    if (!program_id) {
      return NextResponse.json({ error: "program_id query parameter is required" }, { status: 400 });
    }

    await prisma.programStaff.deleteMany({
      where: {
        staff_user_id,
        program_id,
      },
    });

    return NextResponse.json({ data: { message: "Program unassigned successfully" } });
  } catch (error) {
    return handleApiError(error);
  }
}
