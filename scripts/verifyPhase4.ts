import "dotenv/config";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

import { POST as loginHandler } from "../app/api/auth/login/route";
import { POST as bulkUploadPreview } from "../app/api/programs/[id]/bulk-upload/route";
import { POST as bulkUploadCommit } from "../app/api/programs/[id]/bulk-upload/commit/route";

async function responseJson<T = unknown>(
  response: Response
): Promise<{
  data?: T;
  error?: string;
  meta?: { page: number; pageSize: number; total: number };
}> {
  return response.json() as Promise<{
    data?: T;
    error?: string;
    meta?: { page: number; pageSize: number; total: number };
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
  const tag = `phase4-${Date.now()}`;

  // Strict tracking of created entity IDs for cleanup
  const createdParticipantIds: string[] = [];
  const createdProgramIds: string[] = [];
  const createdEnrollmentIds: string[] = [];
  const createdStaffUserIds: string[] = [];

  try {
    console.log("--- Setup test admin, facilitator, and program ---");
    // Admin login
    const adminLoginRes = await loginHandler(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: "admin@developmenthub.ng",
          password: "admin123",
        }),
      }) as never
    );
    assert.equal(adminLoginRes.status, 200);
    const adminCookie = extractCookieHeader(adminLoginRes);
    assert(adminCookie, "Admin cookie required");

    // Facilitator login
    const facilitatorLoginRes = await loginHandler(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: "facilitator@developmenthub.ng",
          password: "facilitator123",
        }),
      }) as never
    );
    assert.equal(facilitatorLoginRes.status, 200);
    const facilitatorCookie = extractCookieHeader(facilitatorLoginRes);
    assert(facilitatorCookie, "Facilitator cookie required");

    // Create target test program
    const targetProgram = await prisma.program.create({
      data: { name: `Target Program ${tag}`, status: "active" },
    });
    createdProgramIds.push(targetProgram.id);

    // Create unassigned test program for facilitator 403 test
    const unassignedProgram = await prisma.program.create({
      data: { name: `Unassigned Program ${tag}`, status: "active" },
    });
    createdProgramIds.push(unassignedProgram.id);

    // Create existing participant to test email deduplication
    const existingParticipant = await prisma.participant.create({
      data: {
        first_name: "Pre-existing",
        last_name: "Participant",
        nin_number: "NIN-TEST",
        full_name: "Pre-existing Participant",
        email: `preexisting-${tag}@example.com`,
        phone: `+23499${Date.now().toString().slice(-8)}`,
      },
    });
    createdParticipantIds.push(existingParticipant.id);

    // Sample CSV data with 6 rows:
    // Row 1: Valid new participant
    // Row 2: Valid new participant (phone only)
    // Row 3: Duplicate matching existingParticipant's email
    // Row 4: Missing email & phone (should skip)
    // Row 5: Invalid email format (should skip)
    // Row 6: Valid new participant
    const csvContent = [
      "full_name,email,phone,gender,date_of_birth",
      `New Person A,newa-${tag}@example.com,+234810000001,female,2002-01-01`,
      `New Person B,,+234810000002,male,1999-05-05`,
      `Duplicate Person,${existingParticipant.email},+234810000003,female,`,
      `Missing Contact Person,,,male,`,
      `Invalid Email Person,invalid-email-str,+234810000005,female,`,
      `New Person C,newc-${tag}@example.com,+234810000006,male,`,
    ].join("\n");

    console.log("--- Test 1: Preview Endpoint is Read-Only (0 DB writes) ---");
    const participantCountBefore = await prisma.participant.count();
    const enrollmentCountBefore = await prisma.enrollment.count();

    const previewRes = await responseJson<{
      total: number;
      new_participant_count: number;
      new_enrollment_count: number;
      skipped_count: number;
      rows: Array<{ row_number: number; action: string; skip_reason: string | null }>;
    }>(
      await bulkUploadPreview(
        new Request(`http://localhost/api/programs/${targetProgram.id}/bulk-upload`, {
          method: "POST",
          headers: {
            Cookie: adminCookie,
            "Content-Type": "text/csv",
          },
          body: csvContent,
        }) as never,
        { params: Promise.resolve({ id: targetProgram.id }) }
      )
    );

    const participantCountAfter = await prisma.participant.count();
    const enrollmentCountAfter = await prisma.enrollment.count();

    assert.equal(participantCountBefore, participantCountAfter, "Preview must NOT modify participant table");
    assert.equal(enrollmentCountBefore, enrollmentCountAfter, "Preview must NOT modify enrollment table");

    const previewData = previewRes.data!;
    assert.equal(previewData.total, 6);
    assert.equal(previewData.new_participant_count, 3); // Rows 1, 2, 6
    assert.equal(previewData.new_enrollment_count, 1);  // Row 3 (existing email)
    assert.equal(previewData.skipped_count, 2);         // Rows 4 & 5
    console.log("PASS: Preview endpoint is 100% read-only with accurate summary counts");

    console.log("--- Test 2: Commit Bulk Upload & Deduplication ---");
    const commitRes = await responseJson<{
      total: number;
      created_count: number;
      enrolled_count: number;
      skipped_count: number;
      skipped_details: Array<{ row_number: number; reason: string }>;
      results: Array<{ row_number: number; status: string; participant_id?: string; enrollment_id?: string }>;
    }>(
      await bulkUploadCommit(
        new Request(`http://localhost/api/programs/${targetProgram.id}/bulk-upload/commit`, {
          method: "POST",
          headers: {
            Cookie: adminCookie,
            "Content-Type": "text/csv",
          },
          body: csvContent,
        }) as never,
        { params: Promise.resolve({ id: targetProgram.id }) }
      )
    );

    const commitData = commitRes.data!;
    assert.equal(commitData.total, 6);
    assert.equal(commitData.created_count, 3);
    assert.equal(commitData.enrolled_count, 1);
    assert.equal(commitData.skipped_count, 2);

    // Record created IDs for cleanup
    for (const item of commitData.results) {
      if (item.participant_id && item.participant_id !== existingParticipant.id) {
        createdParticipantIds.push(item.participant_id);
      }
      if (item.enrollment_id) {
        createdEnrollmentIds.push(item.enrollment_id);
      }
    }

    // Verify existing participant was reused (Row 3)
    const row3Result = commitData.results.find((r) => r.row_number === 3);
    assert(row3Result);
    assert.equal(row3Result.status, "enrolled");
    assert.equal(row3Result.participant_id, existingParticipant.id, "Existing participant must be reused");

    // Verify skipped rows have specific reasons
    const skippedRow4 = commitData.skipped_details.find((s) => s.row_number === 4);
    assert(skippedRow4);
    assert.equal(skippedRow4.reason, "At least one of email or phone is required");

    const skippedRow5 = commitData.skipped_details.find((s) => s.row_number === 5);
    assert(skippedRow5);
    assert.equal(skippedRow5.reason, "Invalid email format");
    console.log("PASS: Commit created valid rows, reused existing participant, and skipped bad rows with clear reasons");

    console.log("--- Test 3: Idempotency (Re-uploading same CSV shows all rows as already enrolled) ---");
    const reuploadRes = await responseJson<{
      total: number;
      created_count: number;
      enrolled_count: number;
      skipped_count: number;
      skipped_details: Array<{ row_number: number; reason: string }>;
    }>(
      await bulkUploadCommit(
        new Request(`http://localhost/api/programs/${targetProgram.id}/bulk-upload/commit`, {
          method: "POST",
          headers: {
            Cookie: adminCookie,
            "Content-Type": "text/csv",
          },
          body: csvContent,
        }) as never,
        { params: Promise.resolve({ id: targetProgram.id }) }
      )
    );

    const reuploadData = reuploadRes.data!;
    assert.equal(reuploadData.created_count, 0);
    assert.equal(reuploadData.enrolled_count, 0);
    assert.equal(reuploadData.skipped_count, 6);
    assert(
      reuploadData.skipped_details.every((s) =>
        s.reason.includes("Already enrolled") || s.reason.includes("required") || s.reason.includes("format")
      )
    );
    console.log("PASS: Re-uploading CSV shows all rows as skipped/already enrolled");

    console.log("--- Test 4: Facilitator Unassigned Program Bulk Upload Returns 403 ---");
    const facilitatorUnassignedRes = await bulkUploadPreview(
      new Request(`http://localhost/api/programs/${unassignedProgram.id}/bulk-upload`, {
        method: "POST",
        headers: {
          Cookie: facilitatorCookie,
          "Content-Type": "text/csv",
        },
        body: csvContent,
      }) as never,
      { params: Promise.resolve({ id: unassignedProgram.id }) }
    );
    assert.equal(facilitatorUnassignedRes.status, 403);
    console.log("PASS: Facilitator upload to unassigned program blocked with 403");

    console.log("Phase 4 verification passed successfully");
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
