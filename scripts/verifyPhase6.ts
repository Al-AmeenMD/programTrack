import "dotenv/config";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

import { POST as loginHandler } from "../app/api/auth/login/route";
import { GET as getCourseSessions, POST as createCourseSession } from "../app/api/courses/[id]/sessions/route";
import { GET as getSession, PATCH as updateSession, DELETE as deleteSession } from "../app/api/sessions/[id]/route";
import { GET as getAttendance, POST as postAttendance } from "../app/api/sessions/[id]/attendance/route";
import { POST as markAllPresent } from "../app/api/sessions/[id]/attendance/mark-all-present/route";
import { PATCH as updateAttendanceRecord } from "../app/api/attendance/[id]/route";

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
  const tag = `phase6-${Date.now()}`;

  const { hashPassword } = await import("../lib/auth");

  // Strict tracking of created entity IDs for cleanup
  const createdStaffIds: string[] = [];
  const createdAttendanceIds: string[] = [];
  const createdSessionIds: string[] = [];
  const createdEnrollmentIds: string[] = [];
  const createdParticipantIds: string[] = [];
  const createdCourseIds: string[] = [];
  const createdProgramIds: string[] = [];

  try {
    console.log("=== PHASE 6: COURSE-SCOPED SESSIONS & RBAC VERIFICATION SUITE ===");
    console.log("\n--- Step 0: Auth & Fixture Setup ---");
    // Create test admin
    const adminUser = await prisma.staffUser.upsert({
      where: { email: `admin_${tag}@test.com` },
      update: {},
      create: {
        full_name: `Admin Test ${tag}`,
        email: `admin_${tag}@test.com`,
        password_hash: hashPassword("admin123"),
        role: "admin",
      },
    });
    createdStaffIds.push(adminUser.id);

    // Admin login
    const adminLoginRes = await loginHandler(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: `admin_${tag}@test.com`,
          password: "admin123",
        }),
      }) as never
    );
    assert.equal(adminLoginRes.status, 200);
    const adminCookie = extractCookieHeader(adminLoginRes);
    assert(adminCookie, "Admin cookie required");
    console.log("  ✓ Admin account created and authenticated (200)");

    // Create test facilitator
    const facilitatorUser = await prisma.staffUser.upsert({
      where: { email: `facilitator_${tag}@test.com` },
      update: {},
      create: {
        full_name: `Facilitator Test ${tag}`,
        email: `facilitator_${tag}@test.com`,
        password_hash: hashPassword("facilitator123"),
        role: "facilitator",
      },
    });
    createdStaffIds.push(facilitatorUser.id);

    // Facilitator login
    const facilitatorLoginRes = await loginHandler(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: `facilitator_${tag}@test.com`,
          password: "facilitator123",
        }),
      }) as never
    );
    assert.equal(facilitatorLoginRes.status, 200);
    const facilitatorCookie = extractCookieHeader(facilitatorLoginRes);
    assert(facilitatorCookie, "Facilitator cookie required");
    console.log("  ✓ Facilitator account created and authenticated (200)");

    // Create target test program A (assigned to facilitator)
    const programA = await prisma.program.create({
      data: { name: `Assigned Program A ${tag}`, status: "active" },
    });
    createdProgramIds.push(programA.id);

    // Create target course A under program A
    const courseA = await prisma.course.create({
      data: { program_id: programA.id, name: `Assigned Course A ${tag}` },
    });
    createdCourseIds.push(courseA.id);
    console.log("  ✓ Test Program A and Course A created");

    // Create unassigned test program B
    const programB = await prisma.program.create({
      data: { name: `Unassigned Program B ${tag}`, status: "active" },
    });
    createdProgramIds.push(programB.id);

    // Create unassigned course B under program B
    const courseB = await prisma.course.create({
      data: { program_id: programB.id, name: `Unassigned Course B ${tag}` },
    });
    createdCourseIds.push(courseB.id);
    console.log("  ✓ Unassigned Program B and Course B created");

    // Assign Program A and Course A to facilitator
    const psA = await prisma.programStaff.upsert({
      where: {
        staff_user_id_program_id: {
          staff_user_id: facilitatorUser.id,
          program_id: programA.id,
        },
      },
      update: {},
      create: {
        staff_user_id: facilitatorUser.id,
        program_id: programA.id,
      },
    });

    await prisma.facilitatorCourse.create({
      data: {
        program_staff_id: psA.id,
        course_id: courseA.id,
      },
    });
    console.log("  ✓ Facilitator assigned to Program A and Course A");

    // Create 3 participants & enrollments in Course A (Program A)
    const part1 = await prisma.participant.create({
      data: { first_name: "Participant", last_name: "One", nin_number: "NIN-TEST", full_name: "Participant One", email: `p1-${tag}@example.com` },
    });
    createdParticipantIds.push(part1.id);
    const enroll1 = await prisma.enrollment.create({
      data: { participant_id: part1.id, program_id: programA.id, course_id: courseA.id, status: "active" },
    });
    createdEnrollmentIds.push(enroll1.id);

    const part2 = await prisma.participant.create({
      data: { first_name: "Participant", last_name: "Two", nin_number: "NIN-TEST", full_name: "Participant Two", email: `p2-${tag}@example.com` },
    });
    createdParticipantIds.push(part2.id);
    const enroll2 = await prisma.enrollment.create({
      data: { participant_id: part2.id, program_id: programA.id, course_id: courseA.id, status: "active" },
    });
    createdEnrollmentIds.push(enroll2.id);

    const part3 = await prisma.participant.create({
      data: { first_name: "Participant", last_name: "Three", nin_number: "NIN-TEST", full_name: "Participant Three", email: `p3-${tag}@example.com` },
    });
    createdParticipantIds.push(part3.id);
    const enroll3 = await prisma.enrollment.create({
      data: { participant_id: part3.id, program_id: programA.id, course_id: courseA.id, status: "active" },
    });
    createdEnrollmentIds.push(enroll3.id);
    console.log("  ✓ 3 test participants enrolled in Course A");

    console.log("\n--- Section 1: Course-Scoped Session Creation & Facilitator RBAC ---");
    const createSessionRes = await createCourseSession(
      new Request(`http://localhost/api/courses/${courseA.id}/sessions`, {
        method: "POST",
        headers: { Cookie: facilitatorCookie },
        body: JSON.stringify({
          title: "Session 1: Orientation",
          session_date: "2026-08-01",
        }),
      }) as never,
      { params: Promise.resolve({ id: courseA.id }) }
    );
    assert.equal(createSessionRes.status, 201);
    const sessionData = (await responseJson<{ id: string; title: string; is_active: boolean }>(createSessionRes)).data!;
    assert(sessionData.id);
    assert.equal(sessionData.is_active, true);
    createdSessionIds.push(sessionData.id);
    console.log("  ✓ POST /api/courses/:id/sessions created session for assigned course (201)");
    console.log("  ✓ Created session verified active with valid ID");

    // Facilitator attempting session creation for unassigned Course B returns 403
    const unassignedSessionRes = await createCourseSession(
      new Request(`http://localhost/api/courses/${courseB.id}/sessions`, {
        method: "POST",
        headers: { Cookie: facilitatorCookie },
        body: JSON.stringify({
          title: "Forbidden Session",
          session_date: "2026-08-01",
        }),
      }) as never,
      { params: Promise.resolve({ id: courseB.id }) }
    );
    assert.equal(unassignedSessionRes.status, 403);
    console.log("  ✓ POST /api/courses/:id/sessions rejected unassigned facilitator with 403 Forbidden");

    console.log("\n--- Section 2: Session Soft Delete & Listing Filters ---");
    const session2Res = await createCourseSession(
      new Request(`http://localhost/api/courses/${courseA.id}/sessions`, {
        method: "POST",
        headers: { Cookie: adminCookie },
        body: JSON.stringify({
          title: "Session 2: Soft Delete Test",
          session_date: "2026-08-02",
        }),
      }) as never,
      { params: Promise.resolve({ id: courseA.id }) }
    );
    const session2Data = (await responseJson<{ id: string }>(session2Res)).data!;
    createdSessionIds.push(session2Data.id);
    console.log("  ✓ Admin created Session 2 for soft delete test (201)");

    const deleteSessionRes = await deleteSession(
      new Request(`http://localhost/api/sessions/${session2Data.id}`, {
        method: "DELETE",
        headers: { Cookie: facilitatorCookie },
      }) as never,
      { params: Promise.resolve({ id: session2Data.id }) }
    );
    assert.equal(deleteSessionRes.status, 200);
    console.log("  ✓ Facilitator soft-deleted Session 2 via DELETE /api/sessions/:id (200)");

    const activeSessionsRes = await responseJson<Array<{ id: string }>>(
      await getCourseSessions(
        new Request(`http://localhost/api/courses/${courseA.id}/sessions`, {
          headers: { Cookie: facilitatorCookie },
        }) as never,
        { params: Promise.resolve({ id: courseA.id }) }
      )
    );
    const activeIds = (activeSessionsRes.data || []).map((s) => s.id);
    assert(activeIds.includes(sessionData.id));
    assert(!activeIds.includes(session2Data.id), "Soft-deleted session must be excluded from default list");
    console.log("  ✓ GET /api/courses/:id/sessions excludes soft-deleted session by default");

    const allSessionsRes = await responseJson<Array<{ id: string }>>(
      await getCourseSessions(
        new Request(`http://localhost/api/courses/${courseA.id}/sessions?include_inactive=true`, {
          headers: { Cookie: facilitatorCookie },
        }) as never,
        { params: Promise.resolve({ id: courseA.id }) }
      )
    );
    const allIds = (allSessionsRes.data || []).map((s) => s.id);
    assert(allIds.includes(session2Data.id), "Soft-deleted session included when include_inactive=true");
    console.log("  ✓ GET /api/courses/:id/sessions with include_inactive=true includes soft-deleted session");

    console.log("\n--- Section 3: Attendance Roster Scoping & Unmarked Handling ---");
    const getAttendanceUnmarkedRes = await responseJson<
      Array<{ enrollment_id: string; attendance_record: { status: string } | null }>
    >(
      await getAttendance(
        new Request(`http://localhost/api/sessions/${sessionData.id}/attendance`, {
          headers: { Cookie: facilitatorCookie },
        }) as never,
        { params: Promise.resolve({ id: sessionData.id }) }
      )
    );
    assert.equal(getAttendanceUnmarkedRes.data?.length, 3);
    console.log("  ✓ GET /api/sessions/:id/attendance scoped to course returned 3 enrolled participants");
    assert(getAttendanceUnmarkedRes.data.every((item) => item.attendance_record === null));
    console.log("  ✓ All initial participants surfaced with attendance_record: null");

    console.log("\n--- Section 4: Attendance Upsert Re-Marking & Individual PATCH ---");
    // Mark enrollment 1 as "late"
    const markRes1 = await responseJson<Array<{ id: string; status: string }>>(
      await postAttendance(
        new Request(`http://localhost/api/sessions/${sessionData.id}/attendance`, {
          method: "POST",
          headers: { Cookie: facilitatorCookie },
          body: JSON.stringify({
            records: [{ enrollment_id: enroll1.id, status: "late" }],
          }),
        }) as never,
        { params: Promise.resolve({ id: sessionData.id }) }
      )
    );
    assert.equal(markRes1.data?.[0].status, "late");
    const rec1Id = markRes1.data[0].id;
    if (!createdAttendanceIds.includes(rec1Id)) createdAttendanceIds.push(rec1Id);
    console.log("  ✓ POST /api/sessions/:id/attendance marked enrollment 1 as 'late'");

    // Re-mark enrollment 1 as "excused"
    const reMarkRes1 = await responseJson<Array<{ id: string; status: string }>>(
      await postAttendance(
        new Request(`http://localhost/api/sessions/${sessionData.id}/attendance`, {
          method: "POST",
          headers: { Cookie: facilitatorCookie },
          body: JSON.stringify({
            records: [{ enrollment_id: enroll1.id, status: "excused" }],
          }),
        }) as never,
        { params: Promise.resolve({ id: sessionData.id }) }
      )
    );
    assert.equal(reMarkRes1.data?.[0].id, rec1Id, "Upsert must update existing record ID");
    assert.equal(reMarkRes1.data?.[0].status, "excused");
    console.log("  ✓ Upsert re-marking enrollment 1 as 'excused' preserved record ID");

    // Change enrollment 1 back to "late" for the mark-all-present overwrite fix test
    const patchRes = await updateAttendanceRecord(
      new Request(`http://localhost/api/attendance/${rec1Id}`, {
        method: "PATCH",
        headers: { Cookie: facilitatorCookie },
        body: JSON.stringify({ status: "late" }),
      }) as never,
      { params: Promise.resolve({ id: rec1Id }) }
    );
    assert.equal(patchRes.status, 200);
    console.log("  ✓ PATCH /api/attendance/:id updated record back to 'late'");

    console.log("\n--- Section 5: Mark-All-Present Clobber Protection & Response Verification ---");
    // Before call: enroll1 is manually marked "late". enroll2 and enroll3 are unmarked.
    // Call mark-all-present without including enroll1 in except. Include enroll2 as excepted "absent".
    const markAllRes = await responseJson<{
      marked_present: Array<{ id: string; enrollment_id: string; status: string }>;
      skipped_already_marked: Array<{ id: string; enrollment_id: string; status: string }>;
      excepted: Array<{ id: string; enrollment_id: string; status: string }>;
    }>(
      await markAllPresent(
        new Request(`http://localhost/api/sessions/${sessionData.id}/attendance/mark-all-present`, {
          method: "POST",
          headers: { Cookie: facilitatorCookie },
          body: JSON.stringify({
            except: [{ enrollment_id: enroll2.id, status: "absent" }],
          }),
        }) as never,
        { params: Promise.resolve({ id: sessionData.id }) }
      )
    );

    const markAllData = markAllRes.data!;
    assert(markAllData.marked_present, "Response must include marked_present array");
    assert(markAllData.skipped_already_marked, "Response must include skipped_already_marked array");
    assert(markAllData.excepted, "Response must include excepted array");
    console.log("  ✓ mark-all-present returned structured response with all 3 category arrays");

    // Track created attendance IDs for cleanup
    for (const r of [...markAllData.marked_present, ...markAllData.skipped_already_marked, ...markAllData.excepted]) {
      if (r.id && !createdAttendanceIds.includes(r.id)) createdAttendanceIds.push(r.id);
    }

    // 1. Confirm pre-marked enroll1 (status: "late") was skipped and NOT overwritten to "present"
    const skippedEnroll1 = markAllData.skipped_already_marked.find((r) => r.enrollment_id === enroll1.id);
    assert(skippedEnroll1, "enroll1 must be in skipped_already_marked list");
    assert.equal(skippedEnroll1.status, "late", "Pre-marked enrollment 1 status MUST remain 'late'");
    console.log("  ✓ Pre-marked enrollment 1 skipped in response (status remained 'late')");

    // Double check DB state for enroll1
    const dbRecord1 = await prisma.attendanceRecord.findUnique({
      where: {
        session_id_enrollment_id: {
          session_id: sessionData.id,
          enrollment_id: enroll1.id,
        },
      },
    });
    assert.equal(dbRecord1?.status, "late", "Database state for enroll1 MUST remain 'late'");
    console.log("  ✓ Database record for enrollment 1 verified: status remains 'late'");

    // 2. Confirm previously unmarked enroll3 was newly marked "present"
    const newlyMarked3 = markAllData.marked_present.find((r) => r.enrollment_id === enroll3.id);
    assert(newlyMarked3, "enroll3 must be in marked_present list");
    assert.equal(newlyMarked3.status, "present");
    console.log("  ✓ Unmarked enrollment 3 newly marked 'present'");

    // 3. Confirm excepted enroll2 was marked "absent" per except payload
    const excepted2 = markAllData.excepted.find((r) => r.enrollment_id === enroll2.id);
    assert(excepted2, "enroll2 must be in excepted list");
    assert.equal(excepted2.status, "absent");
    console.log("  ✓ Excepted enrollment 2 marked 'absent' per payload");

    console.log("\n--- Section 6: Dropped Enrollment Filtering & Historical Access ---");
    // Update participant 3's enrollment status to 'dropped'
    await prisma.enrollment.update({
      where: { id: enroll3.id },
      data: { status: "dropped" },
    });
    console.log("  ✓ Updated enrollment 3 status to 'dropped'");

    // Default GET attendance (should exclude dropped participant 3)
    const defaultAttendanceRes = await responseJson<Array<{ enrollment_id: string }>>(
      await getAttendance(
        new Request(`http://localhost/api/sessions/${sessionData.id}/attendance`, {
          headers: { Cookie: facilitatorCookie },
        }) as never,
        { params: Promise.resolve({ id: sessionData.id }) }
      )
    );
    const defaultEnrollmentIds = (defaultAttendanceRes.data || []).map((item) => item.enrollment_id);
    assert(!defaultEnrollmentIds.includes(enroll3.id), "Dropped enrollment MUST be excluded from default attendance list");
    assert.equal(defaultEnrollmentIds.length, 2);
    console.log("  ✓ Default GET /api/sessions/:id/attendance excluded dropped enrollment (count: 2)");

    // GET attendance with include_dropped=true (appends dropped participant alongside active ones)
    const includeDroppedRes = await responseJson<Array<{ enrollment_id: string; enrollment_status: string }>>(
      await getAttendance(
        new Request(`http://localhost/api/sessions/${sessionData.id}/attendance?include_dropped=true`, {
          headers: { Cookie: facilitatorCookie },
        }) as never,
        { params: Promise.resolve({ id: sessionData.id }) }
      )
    );
    const includeDroppedIds = (includeDroppedRes.data || []).map((item) => item.enrollment_id);
    assert(includeDroppedIds.includes(enroll3.id), "Dropped enrollment included when include_dropped=true");
    assert.equal(includeDroppedIds.length, 3);
    const droppedItem = includeDroppedRes.data!.find((item) => item.enrollment_id === enroll3.id);
    assert.equal(droppedItem?.enrollment_status, "dropped");
    console.log("  ✓ GET /api/sessions/:id/attendance with include_dropped=true returned dropped enrollment (count: 3)");
    console.log("  ✓ Dropped record retains enrollment_status: 'dropped'");

    console.log("\n>>> ALL PHASE 6 COURSE-SCOPED SESSIONS TESTS PASSED! <<<");
  } finally {
    console.log("\n--- Teardown & Empirical DB Verification ---");
    if (createdAttendanceIds.length > 0) {
      await prisma.attendanceRecord.deleteMany({
        where: { id: { in: createdAttendanceIds } },
      });
    }
    if (createdSessionIds.length > 0) {
      await prisma.session.deleteMany({
        where: { id: { in: createdSessionIds } },
      });
    }
    if (createdEnrollmentIds.length > 0) {
      await prisma.enrollment.deleteMany({
        where: { id: { in: createdEnrollmentIds } },
      });
    }
    if (createdParticipantIds.length > 0) {
      await prisma.participant.deleteMany({
        where: { id: { in: createdParticipantIds } },
      });
    }
    if (createdCourseIds.length > 0) {
      await prisma.facilitatorCourse.deleteMany({
        where: { course_id: { in: createdCourseIds } },
      });
      await prisma.course.deleteMany({
        where: { id: { in: createdCourseIds } },
      });
    }
    if (createdProgramIds.length > 0) {
      await prisma.programStaff.deleteMany({
        where: { program_id: { in: createdProgramIds } },
      });
      await prisma.program.deleteMany({
        where: { id: { in: createdProgramIds } },
      });
    }
    if (createdStaffIds.length > 0) {
      await prisma.staffUser.deleteMany({
        where: { id: { in: createdStaffIds } },
      });
    }

    // Empirical before/after row count assertion
    const remainingAttendance = await prisma.attendanceRecord.count({
      where: { id: { in: createdAttendanceIds } },
    });
    const remainingSessions = await prisma.session.count({
      where: { id: { in: createdSessionIds } },
    });
    const remainingCourses = await prisma.course.count({
      where: { id: { in: createdCourseIds } },
    });
    const remainingPrograms = await prisma.program.count({
      where: { id: { in: createdProgramIds } },
    });
    const remainingParticipants = await prisma.participant.count({
      where: { id: { in: createdParticipantIds } },
    });
    const remainingStaff = await prisma.staffUser.count({
      where: { id: { in: createdStaffIds } },
    });

    assert.equal(remainingAttendance, 0, "Empirical check: 0 test attendance records must remain");
    assert.equal(remainingSessions, 0, "Empirical check: 0 test sessions must remain");
    assert.equal(remainingCourses, 0, "Empirical check: 0 test courses must remain");
    assert.equal(remainingPrograms, 0, "Empirical check: 0 test programs must remain");
    assert.equal(remainingParticipants, 0, "Empirical check: 0 test participants must remain");
    assert.equal(remainingStaff, 0, "Empirical check: 0 test staff users must remain");

    await prisma.$disconnect();
    await pool.end();
    console.log("  ✓ Teardown complete: verified 0 leftover test records in DB across all tables");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
