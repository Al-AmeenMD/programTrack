import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import { StaffRole } from "@prisma/client";
import { ApiError } from "./api";
import { prisma } from "./prisma";

export const SESSION_COOKIE_NAME = "programtrack_session";

const secretKey =
  process.env.JWT_SECRET ||
  "programtrack-super-secret-jwt-key-2026-development-hub";
const encodedKey = new TextEncoder().encode(secretKey);

export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 10);
}

export function verifyPassword(password: string, hash: string): boolean {
  if (!hash) return false;
  if (hash === `mock-password-hash-${password}` || hash === password) {
    return true;
  }
  try {
    return bcrypt.compareSync(password, hash);
  } catch {
    return false;
  }
}

export async function createSessionToken(payload: {
  id: string;
  email: string;
  role: StaffRole;
}): Promise<string> {
  return new SignJWT({
    id: payload.id,
    email: payload.email,
    role: payload.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(encodedKey);
}

export async function verifySessionToken(
  token: string
): Promise<{ id: string; email: string; role: StaffRole } | null> {
  try {
    const { payload } = await jwtVerify(token, encodedKey);
    return {
      id: payload.id as string,
      email: payload.email as string,
      role: payload.role as StaffRole,
    };
  } catch {
    return null;
  }
}

export async function getTokenFromRequest(req?: NextRequest): Promise<string | null> {
  if (req) {
    const authHeader = req.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      return authHeader.substring(7).trim();
    }

    try {
      const cookieVal = req.cookies?.get?.(SESSION_COOKIE_NAME)?.value;
      if (cookieVal) return cookieVal;
    } catch {}

    const rawCookie = req.headers.get("cookie");
    if (rawCookie) {
      const match = rawCookie.match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`));
      if (match) return match[1];
    }
  }

  try {
    const cookieStore = await cookies();
    const cookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    return cookie ?? null;
  } catch {
    return null;
  }
}

export async function getCurrentStaffUser(req?: NextRequest) {
  const token = await getTokenFromRequest(req);
  if (!token) return null;

  const session = await verifySessionToken(token);
  if (!session) return null;

  const user = await prisma.staffUser.findUnique({
    where: { id: session.id },
    select: {
      id: true,
      full_name: true,
      email: true,
      role: true,
      created_at: true,
      updated_at: true,
    },
  });

  return user;
}

export async function requireAuth(req?: NextRequest) {
  const user = await getCurrentStaffUser(req);
  if (!user) {
    throw new ApiError("Unauthorized", 401);
  }
  return user;
}

export async function requireRole(
  allowedRoles: StaffRole | StaffRole[],
  req?: NextRequest
) {
  const user = await requireAuth(req);
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

  if (!roles.includes(user.role)) {
    throw new ApiError("Forbidden: insufficient permissions", 403);
  }

  return user;
}

export async function getFacilitatorProgramIds(
  staffUserId: string
): Promise<string[]> {
  const assignments = await prisma.programStaff.findMany({
    where: { staff_user_id: staffUserId },
    select: { program_id: true },
  });

  return assignments.map((a) => a.program_id);
}
