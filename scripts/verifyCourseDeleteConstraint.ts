import "dotenv/config";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

import { POST as loginHandler } from "../app/api/auth/login/route";
import { POST as createCourse } from "../app/api/programs/[id]/courses/route";
import { POST as createSession } from "../app/api/courses/[id]/sessions/route";
import { DELETE as deleteCourse } from "../app/api/courses/[id]/route";
import { hashPassword } from "../lib/auth";

async function responseJson<T = unknown>(
  response: Response
): Promise<{
  data?: T;
  error?: string;
  meta?: Record<string, unknown>;
}> {
  return response.json() as Promise<{
    data?: T;
    error?: string;
    meta?: Record<string, unknown>;
  }>;
}

function extractCookieHeader(response: Response): string | null {
  const setCookie = response.headers.get("set-cookie");
  if (!setCookie) return null;
  const match = setCookie.match(/programtrack_session=([^;]+)/);
  return match ? `programtrack_session=${match[1]}` : null;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set");
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  const tag = `course-del-${Date.now()}`;

  const createdStaffIds: string[] = [];
  const createdSessionIds: string[] = [];
  const createdCourseIds: string[] = [];
  const createdProgramIds: string[] = [];

  try {
    console.log("--- 1. Auth Setup (Create Admin User & Login) ---");
    const adminUser = await prisma.staffUser.create({
      data: {
        full_name: `Admin Test ${tag}`,
        email: `admin_${tag}@test.com`,
        password_hash: hashPassword("admin123"),
        role: "admin",
      },
    });
    createdStaffIds.push(adminUser.id);

    const adminLoginRes = await loginHandler(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: `admin_${tag}@test.com`,
          password: "admin123",
        }),
      }) as never
    );
    assert.equal(adminLoginRes.status, 200);
    const adminCookie = extractCookieHeader(adminLoginRes);
    assert(adminCookie, "Admin cookie required");
    console.log("  ✓ Admin logged in successfully");

    console.log("--- 2. Create Test Program ---");
    const program = await prisma.program.create({
      data: { name: `Course Delete Test Program ${tag}`, status: "active" },
    });
    createdProgramIds.push(program.id);
    console.log(`  ✓ Created program: ${program.name}`);

    console.log("--- 3. Create Course A (with session) & Course B (without session) ---");
    const createCourseResA = await createCourse(
      new Request(`http://localhost/api/programs/${program.id}/courses`, {
        method: "POST",
        headers: { Cookie: adminCookie, "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Course With Sessions" }),
      }) as never,
      { params: Promise.resolve({ id: program.id }) }
    );
    assert.equal(createCourseResA.status, 201);
    const courseA = (await responseJson<{ id: string; name: string }>(createCourseResA)).data!;
    createdCourseIds.push(courseA.id);
    console.log(`  ✓ Created Course A: ${courseA.name} (${courseA.id})`);

    const createCourseResB = await createCourse(
      new Request(`http://localhost/api/programs/${program.id}/courses`, {
        method: "POST",
        headers: { Cookie: adminCookie, "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Course Without Sessions" }),
      }) as never,
      { params: Promise.resolve({ id: program.id }) }
    );
    assert.equal(createCourseResB.status, 201);
    const courseB = (await responseJson<{ id: string; name: string }>(createCourseResB)).data!;
    createdCourseIds.push(courseB.id);
    console.log(`  ✓ Created Course B: ${courseB.name} (${courseB.id})`);

    console.log("--- 4. Create Session in Course A ---");
    const createSessionRes = await createSession(
      new Request(`http://localhost/api/courses/${courseA.id}/sessions`, {
        method: "POST",
        headers: { Cookie: adminCookie, "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Session 1",
          session_date: new Date().toISOString(),
        }),
      }) as never,
      { params: Promise.resolve({ id: courseA.id }) }
    );
    assert.equal(createSessionRes.status, 201);
    const sessionA = (await responseJson<{ id: string }>(createSessionRes)).data!;
    createdSessionIds.push(sessionA.id);
    console.log(`  ✓ Created Session in Course A (${sessionA.id})`);

    console.log("--- 5. Attempt to DELETE Course A (has attached session) ---");
    const deleteCourseResA = await deleteCourse(
      new Request(`http://localhost/api/courses/${courseA.id}`, {
        method: "DELETE",
        headers: { Cookie: adminCookie },
      }) as never,
      { params: Promise.resolve({ id: courseA.id }) }
    );

    const deleteCourseJsonA = await responseJson(deleteCourseResA);
    console.log(`Response Status: ${deleteCourseResA.status}`);
    console.log(`Response Body:`, JSON.stringify(deleteCourseJsonA, null, 2));

    assert.equal(
      deleteCourseResA.status,
      409,
      `Expected status 409 Conflict when deleting course with sessions, got ${deleteCourseResA.status}`
    );
    assert.equal(
      deleteCourseJsonA.error,
      "Cannot delete this record because other data still depends on it."
    );
    assert.equal(
      deleteCourseJsonA.meta,
      undefined,
      "Response should not expose raw database meta"
    );
    console.log("✓ Successfully caught P2003 and returned clean 409 with no meta exposure!");

    console.log("--- 6. Attempt to DELETE Course B (no sessions) ---");
    const deleteCourseResB = await deleteCourse(
      new Request(`http://localhost/api/courses/${courseB.id}`, {
        method: "DELETE",
        headers: { Cookie: adminCookie },
      }) as never,
      { params: Promise.resolve({ id: courseB.id }) }
    );

    const deleteCourseJsonB = await responseJson<{ message: string }>(deleteCourseResB);
    console.log(`Response Status: ${deleteCourseResB.status}`);
    console.log(`Response Body:`, JSON.stringify(deleteCourseJsonB, null, 2));

    assert.equal(deleteCourseResB.status, 200);
    assert.equal(deleteCourseJsonB.data?.message, "Course deleted successfully");
    console.log("✓ Successfully deleted Course B with 200 OK!");

  } finally {
    console.log("--- Cleanup: Deleting created records ---");
    if (createdSessionIds.length > 0) {
      await prisma.session.deleteMany({
        where: { id: { in: createdSessionIds } },
      });
    }
    if (createdCourseIds.length > 0) {
      await prisma.course.deleteMany({
        where: { id: { in: createdCourseIds } },
      });
    }
    if (createdProgramIds.length > 0) {
      await prisma.program.deleteMany({
        where: { id: { in: createdProgramIds } },
      });
    }
    if (createdStaffIds.length > 0) {
      await prisma.staffUser.deleteMany({
        where: { id: { in: createdStaffIds } },
      });
    }

    await prisma.$disconnect();
    await pool.end();
    console.log("✓ Cleanup finished.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
