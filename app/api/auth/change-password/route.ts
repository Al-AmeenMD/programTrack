import { NextRequest, NextResponse } from "next/server";
import { ApiError, handleApiError } from "@/lib/api";
import { hashPassword, requireAuth, verifyPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { changePasswordSchema } from "@/lib/validation";

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    const body = changePasswordSchema.parse(await req.json());

    const userWithHash = await prisma.staffUser.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        password_hash: true,
      },
    });

    if (!userWithHash) {
      throw new ApiError("User account not found", 440);
    }

    const isValidCurrentPassword = verifyPassword(
      body.current_password,
      userWithHash.password_hash
    );

    if (!isValidCurrentPassword) {
      throw new ApiError("Current password is incorrect", 400);
    }

    await prisma.staffUser.update({
      where: { id: user.id },
      data: {
        password_hash: hashPassword(body.new_password),
      },
    });

    return NextResponse.json({
      data: { message: "Password updated successfully" },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
