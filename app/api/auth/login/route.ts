import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "../../../../lib/api";
import { createSessionToken, verifyPassword, SESSION_COOKIE_NAME } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";
import { loginSchema } from "../../../../lib/validation";

export async function POST(req: NextRequest) {
  try {
    const body = loginSchema.parse(await req.json());

    const user = await prisma.staffUser.findUnique({
      where: { email: body.email },
    });

    if (!user || !verifyPassword(body.password, user.password_hash)) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    const token = await createSessionToken({
      id: user.id,
      email: user.email,
      role: user.role,
    });

    const response = NextResponse.json({
      data: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        role: user.role,
        created_at: user.created_at,
        updated_at: user.updated_at,
      },
    });

    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60,
    });

    return response;
  } catch (error) {
    return handleApiError(error);
  }
}
