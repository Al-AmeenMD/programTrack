import "dotenv/config";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

import { POST as loginHandler } from "../app/api/auth/login/route";
import { POST as logoutHandler } from "../app/api/auth/logout/route";
import { GET as meHandler } from "../app/api/auth/me/route";
import { GET as getParticipants, POST as createParticipant } from "../app/api/participants/route";
import { GET as getParticipant, PATCH as updateParticipant, DELETE as deleteParticipant } from "../app/api/participants/[id]/route";
import { GET as getPrograms, POST as createProgram } from "../app/api/programs/route";
import { GET as getProgramEnrollments } from "../app/api/programs/[id]/enrollments/route";
import { PATCH as updateEnrollment, DELETE as deleteEnrollment } from "../app/api/enrollments/[id]/route";
import { GET as getStaff, POST as createStaff } from "../app/api/staff/route";
import { POST as assignStaffProgram } from "../app/api/staff/[id]/programs/route";

async function responseJson<T = unknown>(response: Response): Promise<{ data?: T; error?: string; meta?: { page: number; pageSize: number; total: number } }> {
  return response.json() as Promise<{ data?: T; error?: string; meta?: { page: number; pageSize: number; total: number } }>;
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
  const tag = `phase3-${Date.now()}`;

  // Strict tracking of created entity IDs for cleanup
  const createdParticipantIds: string[] = [];
  const createdProgramIds: string[] = [];
  const createdEnrollmentIds: string[] = [];
  const createdStaffUserIds: string[] = [];

  try {
    console.log("--- Test 1: Login invalid credentials returns 401 ---");
    const invalidLoginRes = await loginHandler(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: "admin@programtrack.ng",
          password: "wrongpassword",
        }),
      }) as never
    );
    assert.equal(invalidLoginRes.status, 401);
    console.log("PASS: Invalid login rejected with 401");

    console.log("--- Test 2: Login valid admin credentials returns session & role ---");
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
    assert(adminCookie, "Session cookie should be set for admin");
    const adminLoginData = (await responseJson(adminLoginRes)).data as { role: string; password_hash?: string };
    assert.equal(adminLoginData.role, "admin");
    assert.equal(adminLoginData.password_hash, undefined, "password_hash must never be returned");
    console.log("PASS: Admin login successful, no password_hash in response");

    console.log("--- Test 3: Login valid facilitator credentials returns session & role ---");
    const facilitatorLoginRes = await loginHandler(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: "facilitator@programtrack.ng",
          password: "facilitator123",
        }),
      }) as never
    );
    assert.equal(facilitatorLoginRes.status, 200);
    const facilitatorCookie = extractCookieHeader(facilitatorLoginRes);
    assert(facilitatorCookie, "Session cookie should be set for facilitator");
    const facilitatorLoginData = (await responseJson(facilitatorLoginRes)).data as { role: string; password_hash?: string };
    assert.equal(facilitatorLoginData.role, "facilitator");
    assert.equal(facilitatorLoginData.password_hash, undefined);
    console.log("PASS: Facilitator login successful");

    console.log("--- Test 4: Facilitator attempting POST /api/staff receives 403 ---");
    const facilitatorStaffCreateRes = await createStaff(
      new Request("http://localhost/api/staff", {
        method: "POST",
        headers: { Cookie: facilitatorCookie },
        body: JSON.stringify({
          full_name: "Illegal Staff",
          email: `illegal-${tag}@example.com`,
          password: "password123",
          role: "facilitator",
        }),
      }) as never
    );
    assert.equal(facilitatorStaffCreateRes.status, 403);
    console.log("PASS: Facilitator staff creation blocked with 403");

    console.log("--- Test 5: Facilitator scoping on GET /api/participants & dual-enrollment edge case ---");
    // Setup 2 programs: Assigned (Program A) and Unassigned (Program B)
    const programA = await prisma.program.create({
      data: { name: `Assigned Program A ${tag}`, status: "active" },
    });
    createdProgramIds.push(programA.id);

    const programB = await prisma.program.create({
      data: { name: `Unassigned Program B ${tag}`, status: "active" },
    });
    createdProgramIds.push(programB.id);

    const facilitatorUser = await prisma.staffUser.findUniqueOrThrow({
      where: { email: "facilitator@programtrack.ng" },
    });

    // Assign Program A to facilitator via ProgramStaff
    await prisma.programStaff.upsert({
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

    // Create Participant 1 in Program A (Assigned)
    const part1 = await prisma.participant.create({
      data: { first_name: "Assigned", last_name: "Participant Only", nin_number: "NIN-TEST", full_name: "Assigned Participant Only", email: `part1-${tag}@example.com` },
    });
    createdParticipantIds.push(part1.id);
    const enroll1 = await prisma.enrollment.create({
      data: { participant_id: part1.id, program_id: programA.id, status: "active" },
    });
    createdEnrollmentIds.push(enroll1.id);

    // Create Participant 2 in Program B (Unassigned)
    const part2 = await prisma.participant.create({
      data: { first_name: "Unassigned", last_name: "Participant Only", nin_number: "NIN-TEST", full_name: "Unassigned Participant Only", email: `part2-${tag}@example.com` },
    });
    createdParticipantIds.push(part2.id);
    const enroll2 = await prisma.enrollment.create({
      data: { participant_id: part2.id, program_id: programB.id, status: "active" },
    });
    createdEnrollmentIds.push(enroll2.id);

    // Create Dual-Enrolled Participant 3 (In BOTH Program A and Program B)
    const partDual = await prisma.participant.create({
      data: { first_name: "Dual", last_name: "Enrolled Participant", nin_number: "NIN-TEST", full_name: "Dual Enrolled Participant", email: `partdual-${tag}@example.com` },
    });
    createdParticipantIds.push(partDual.id);

    const enrollDualA = await prisma.enrollment.create({
      data: { participant_id: partDual.id, program_id: programA.id, status: "active" },
    });
    createdEnrollmentIds.push(enrollDualA.id);

    const enrollDualB = await prisma.enrollment.create({
      data: { participant_id: partDual.id, program_id: programB.id, status: "active" },
    });
    createdEnrollmentIds.push(enrollDualB.id);

    // Facilitator GET /api/participants
    const facilitatorParticipantsRes = await responseJson<Array<{ id: string }>>(
      await getParticipants(
        new Request("http://localhost/api/participants?page=1&pageSize=100", {
          headers: { Cookie: facilitatorCookie },
        }) as never
      )
    );
    const returnedParticipantIds = (facilitatorParticipantsRes.data || []).map((p) => p.id);

    assert(returnedParticipantIds.includes(part1.id), "Facilitator should see participant in assigned program");
    assert(returnedParticipantIds.includes(partDual.id), "Facilitator should see dual-enrolled participant in assigned program");
    assert(!returnedParticipantIds.includes(part2.id), "Facilitator MUST NOT see participant in unassigned program");
    console.log("PASS: Facilitator participant list correctly scoped");

    // Dual-Enrolled Participant edge cases:
    // 1. GET /api/participants/:id for Dual Participant -> Allowed
    const dualGetRes = await getParticipant(
      new Request(`http://localhost/api/participants/${partDual.id}`, {
        headers: { Cookie: facilitatorCookie },
      }) as never,
      { params: Promise.resolve({ id: partDual.id }) }
    );
    assert.equal(dualGetRes.status, 200);

    // 2. Facilitator PATCH participant core info -> Allowed (since enrolled in assigned Program A)
    const dualPatchRes = await updateParticipant(
      new Request(`http://localhost/api/participants/${partDual.id}`, {
        method: "PATCH",
        headers: { Cookie: facilitatorCookie },
        body: JSON.stringify({ full_name: "Dual Enrolled Participant Updated" }),
      }) as never,
      { params: Promise.resolve({ id: partDual.id }) }
    );
    assert.equal(dualPatchRes.status, 200);

    // 3. Facilitator PATCH enrollment for assigned Program A -> Allowed
    const enrollPatchAllowedRes = await updateEnrollment(
      new Request(`http://localhost/api/enrollments/${enrollDualA.id}`, {
        method: "PATCH",
        headers: { Cookie: facilitatorCookie },
        body: JSON.stringify({ status: "completed" }),
      }) as never,
      { params: Promise.resolve({ id: enrollDualA.id }) }
    );
    assert.equal(enrollPatchAllowedRes.status, 200);

    // 4. Facilitator PATCH enrollment for unassigned Program B -> Blocked 403 Forbidden
    const enrollPatchBlockedRes = await updateEnrollment(
      new Request(`http://localhost/api/enrollments/${enrollDualB.id}`, {
        method: "PATCH",
        headers: { Cookie: facilitatorCookie },
        body: JSON.stringify({ status: "completed" }),
      }) as never,
      { params: Promise.resolve({ id: enrollDualB.id }) }
    );
    assert.equal(enrollPatchBlockedRes.status, 403);
    console.log("PASS: Dual-enrolled participant edge cases verified (unassigned enrollment PATCH blocked with 403)");

    console.log("--- Test 6: Admin sees all participants without restriction ---");
    const adminParticipantsRes = await responseJson<Array<{ id: string }>>(
      await getParticipants(
        new Request("http://localhost/api/participants?page=1&pageSize=100", {
          headers: { Cookie: adminCookie },
        }) as never
      )
    );
    const adminReturnedIds = (adminParticipantsRes.data || []).map((p) => p.id);
    assert(adminReturnedIds.includes(part1.id));
    assert(adminReturnedIds.includes(part2.id));
    assert(adminReturnedIds.includes(partDual.id));
    console.log("PASS: Admin sees system-wide participants");

    console.log("--- Test 7: Admin staff creation & program assignment ---");
    const newStaffRes = await responseJson<{ id: string; role: string }>(
      await createStaff(
        new Request("http://localhost/api/staff", {
          method: "POST",
          headers: { Cookie: adminCookie },
          body: JSON.stringify({
            full_name: "New Facilitator",
            email: `newfac-${tag}@example.com`,
            password: "password123",
            role: "facilitator",
          }),
        }) as never
      )
    );
    assert(newStaffRes.data?.id);
    assert.equal(newStaffRes.data.role, "facilitator");
    createdStaffUserIds.push(newStaffRes.data.id);

    const assignRes = await assignStaffProgram(
      new Request(`http://localhost/api/staff/${newStaffRes.data.id}/programs`, {
        method: "POST",
        headers: { Cookie: adminCookie },
        body: JSON.stringify({ program_id: programB.id }),
      }) as never,
      { params: Promise.resolve({ id: newStaffRes.data.id }) }
    );
    assert.equal(assignRes.status, 201);
    console.log("PASS: Admin created staff user and assigned program successfully");

    console.log("--- Test 8: Logout clears session ---");
    const logoutRes = await logoutHandler();
    assert.equal(logoutRes.status, 200);

    const meResAfterLogout = await meHandler(
      new Request("http://localhost/api/auth/me") as never
    );
    assert.equal(meResAfterLogout.status, 401);
    console.log("PASS: Logout cleared session, subsequent auth check returned 401");

    console.log("Phase 3 verification passed successfully");
  } finally {
    console.log("--- Cleanup: Strictly deleting ONLY exact created test IDs ---");
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
    if (createdProgramIds.length > 0) {
      await prisma.programStaff.deleteMany({
        where: { program_id: { in: createdProgramIds } },
      });
      await prisma.program.deleteMany({
        where: { id: { in: createdProgramIds } },
      });
    }
    if (createdStaffUserIds.length > 0) {
      await prisma.programStaff.deleteMany({
        where: { staff_user_id: { in: createdStaffUserIds } },
      });
      await prisma.staffUser.deleteMany({
        where: { id: { in: createdStaffUserIds } },
      });
    }

    // Empirical before/after row count assertion
    const remainingPrograms = await prisma.program.count({
      where: { id: { in: createdProgramIds } },
    });
    const remainingParticipants = await prisma.participant.count({
      where: { id: { in: createdParticipantIds } },
    });
    const remainingStaff = await prisma.staffUser.count({
      where: { id: { in: createdStaffUserIds } },
    });

    assert.equal(remainingPrograms, 0, "Empirical check: 0 test programs must remain");
    assert.equal(remainingParticipants, 0, "Empirical check: 0 test participants must remain");
    assert.equal(remainingStaff, 0, "Empirical check: 0 test staff users must remain");

    await prisma.$disconnect();
    await pool.end();
    console.log("PASS: Empirical cleanup check confirmed 0 leftover test records in DB");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
