import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "../../../../lib/auth";

export async function POST() {
  const response = NextResponse.json({
    data: { message: "Logged out successfully" },
  });

  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  return response;
}

export async function GET(req: NextRequest) {
  const loginUrl = new URL("/login?logout=true", req.url);
  const response = NextResponse.redirect(loginUrl);

  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  return response;
}
