import "dotenv/config";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

import { POST as loginHandler } from "../app/api/auth/login/route";
import { GET as getCourses, POST as createCourse } from "../app/api/programs/[id]/courses/route";
import { PATCH as updateCourse, DELETE as deleteCourse } from "../app/api/courses/[id]/route";
import { POST as createParticipant } from "../app/api/participants/route";
import { POST as bulkUploadPreview } from "../app/api/programs/[id]/bulk-upload/route";
import { POST as bulkUploadCommit } from "../app/api/programs/[id]/bulk-upload/commit/route";
import { GET as getEnrollments } from "../app/api/programs/[id]/enrollments/route";

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
  const tag = `course-fix-${Date.now()}`;

  const createdCourseIds: string[] = [];
  const createdEnrollmentIds: string[] = [];
  const createdParticipantIds: string[] = [];
  const createdProgramIds: string[] = [];

  try {
    console.log("--- Setup: Login Admin & Create Test Program ---");
    const adminLoginRes = await loginHandler(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: "admin@programtrack.ng",
          password: "admin123",
        }),
      }) as never
    );
    assert.equal(adminLoginRes.status, 200);
    const adminCookie = extractCookieHeader(adminLoginRes);
    assert(adminCookie, "Admin cookie required");

    const program = await prisma.program.create({
      data: { name: `IDEAS Cohort Test ${tag}`, status: "active" },
    });
    createdProgramIds.push(program.id);

    console.log("--- Test 1: Create Courses (POST /api/programs/:id/courses) ---");
    const createCourseRes1 = await createCourse(
      new Request(`http://localhost/api/programs/${program.id}/courses`, {
        method: "POST",
        headers: { Cookie: adminCookie },
        body: JSON.stringify({ name: "Web Development" }),
      }) as never,
      { params: Promise.resolve({ id: program.id }) }
    );
    assert.equal(createCourseRes1.status, 201);
    const course1 = (await responseJson<{ id: string; name: string }>(createCourseRes1)).data!;
    assert(course1.id);
    createdCourseIds.push(course1.id);

    const createCourseRes2 = await createCourse(
      new Request(`http://localhost/api/programs/${program.id}/courses`, {
        method: "POST",
        headers: { Cookie: adminCookie },
        body: JSON.stringify({ name: "Data Analytics" }),
      }) as never,
      { params: Promise.resolve({ id: program.id }) }
    );
    assert.equal(createCourseRes2.status, 201);
    const course2 = (await responseJson<{ id: string; name: string }>(createCourseRes2)).data!;
    createdCourseIds.push(course2.id);

    const listCoursesRes = await responseJson<Array<{ id: string; name: string }>>(
      await getCourses(
        new Request(`http://localhost/api/programs/${program.id}/courses`, {
          headers: { Cookie: adminCookie },
        }) as never,
        { params: Promise.resolve({ id: program.id }) }
      )
    );
    assert.equal(listCoursesRes.data?.length, 2);
    console.log("PASS: Created and listed 2 courses for program");

    console.log("--- Test 2: Enroll Participant with course_id ---");
    const enrollRes = await createParticipant(
      new Request("http://localhost/api/participants", {
        method: "POST",
        headers: { Cookie: adminCookie },
        body: JSON.stringify({
          full_name: "Course Student 1",
          email: `student1-${tag}@example.com`,
          program_id: program.id,
          course_id: course1.id,
        }),
      }) as never
    );
    assert.equal(enrollRes.status, 201);
    const enrollData = (
      await responseJson<{ participant: { id: string }; enrollment: { id: string; course_id: string } }>(
        enrollRes
      )
    ).data!;
    assert(enrollData.participant.id);
    assert(enrollData.enrollment.id);
    assert.equal(enrollData.enrollment.course_id, course1.id);
    createdParticipantIds.push(enrollData.participant.id);
    createdEnrollmentIds.push(enrollData.enrollment.id);

    console.log("--- Test 3: Bulk Upload CSV with Course Name Matching & Skip ---");
    const csvContent = `full_name,email,course_name
Bulk Student 1,bulk1-${tag}@example.com,Data Analytics
Bulk Student 2,bulk2-${tag}@example.com,Nonexistent Course`;

    const previewRes = await responseJson<{
      total: number;
      new_participant_count: number;
      skipped_count: number;
      rows: Array<{ action: string; skip_reason: string | null; course_name: string | null }>;
    }>(
      await bulkUploadPreview(
        new Request(`http://localhost/api/programs/${program.id}/bulk-upload`, {
          method: "POST",
          headers: { Cookie: adminCookie, "Content-Type": "text/csv" },
          body: csvContent,
        }) as never,
        { params: Promise.resolve({ id: program.id }) }
      )
    );

    assert.equal(previewRes.data?.total, 2);
    assert.equal(previewRes.data?.new_participant_count, 1);
    assert.equal(previewRes.data?.skipped_count, 1);
    const skippedRow = previewRes.data?.rows.find((r) => r.action === "skip");
    assert(skippedRow?.skip_reason?.includes("Nonexistent Course"));

    // Commit Bulk Upload
    const commitRes = await responseJson<{
      created_count: number;
      results: Array<{ participant_id?: string; enrollment_id?: string }>;
    }>(
      await bulkUploadCommit(
        new Request(`http://localhost/api/programs/${program.id}/bulk-upload/commit`, {
          method: "POST",
          headers: { Cookie: adminCookie, "Content-Type": "text/csv" },
          body: csvContent,
        }) as never,
        { params: Promise.resolve({ id: program.id }) }
      )
    );
    assert.equal(commitRes.data?.created_count, 1);
    for (const r of commitRes.data?.results || []) {
      if (r.participant_id && !createdParticipantIds.includes(r.participant_id))
        createdParticipantIds.push(r.participant_id);
      if (r.enrollment_id && !createdEnrollmentIds.includes(r.enrollment_id))
        createdEnrollmentIds.push(r.enrollment_id);
    }
    console.log("PASS: Bulk upload correctly matched existing course 'Data Analytics' and skipped nonexistent course");

    console.log("--- Test 4: Program Enrollments GET query includes course info ---");
    const getProgramEnrollmentsRes = await responseJson<
      Array<{ id: string; course?: { name: string } | null }>
    >(
      await getEnrollments(
        new Request(`http://localhost/api/programs/${program.id}/enrollments`, {
          headers: { Cookie: adminCookie },
        }) as never,
        { params: Promise.resolve({ id: program.id }) }
      )
    );
    assert.equal(getProgramEnrollmentsRes.data?.length, 2);
    assert(getProgramEnrollmentsRes.data.some((e) => e.course?.name === "Web Development"));
    assert(getProgramEnrollmentsRes.data.some((e) => e.course?.name === "Data Analytics"));
    console.log("PASS: Program enrollments query includes course name association");

  } finally {
    console.log("--- Cleanup: Strictly deleting created test records in FK order ---");
    if (createdEnrollmentIds.length > 0) {
      await prisma.enrollment.deleteMany({
        where: { id: { in: createdEnrollmentIds } },
      });
    }
    if (createdCourseIds.length > 0) {
      await prisma.course.deleteMany({
        where: { id: { in: createdCourseIds } },
      });
    }
    if (createdParticipantIds.length > 0) {
      await prisma.participant.deleteMany({
        where: { id: { in: createdParticipantIds } },
      });
    }
    if (createdProgramIds.length > 0) {
      await prisma.program.deleteMany({
        where: { id: { in: createdProgramIds } },
      });
    }

    const remainingCourses = await prisma.course.count({
      where: { id: { in: createdCourseIds } },
    });
    const remainingEnrollments = await prisma.enrollment.count({
      where: { id: { in: createdEnrollmentIds } },
    });
    const remainingPrograms = await prisma.program.count({
      where: { id: { in: createdProgramIds } },
    });

    assert.equal(remainingCourses, 0, "0 test courses must remain");
    assert.equal(remainingEnrollments, 0, "0 test enrollments must remain");
    assert.equal(remainingPrograms, 0, "0 test programs must remain");

    await prisma.$disconnect();
    await pool.end();
    console.log("PASS: Empirical cleanup check confirmed 0 leftover test records in DB");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
