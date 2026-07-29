import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "../../../lib/api";
import { requireRole } from "../../../lib/auth";
import { prisma } from "../../../lib/prisma";
import { createStaffSchema } from "../../../lib/validation";
import { hashPassword } from "../../../lib/auth";

export async function GET(req: NextRequest) {
  try {
    await requireRole("admin", req);

    const staffUsers = await prisma.staffUser.findMany({
      orderBy: [
        { status: "asc" },
        { created_at: "desc" },
      ],
      select: {
        id: true,
        full_name: true,
        email: true,
        role: true,
        status: true,
        created_at: true,
        updated_at: true,
        program_staff: {
          include: {
            program: true,
            courses: {
              include: {
                course: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json({ data: staffUsers });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireRole("admin", req);

    const body = createStaffSchema.parse(await req.json());

    const staffUser = await prisma.staffUser.create({
      data: {
        full_name: body.full_name,
        email: body.email,
        password_hash: hashPassword(body.password),
        role: body.role,
        status: "active",
      },
      select: {
        id: true,
        full_name: true,
        email: true,
        role: true,
        status: true,
        created_at: true,
        updated_at: true,
      },
    });

    return NextResponse.json({ data: staffUser }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
