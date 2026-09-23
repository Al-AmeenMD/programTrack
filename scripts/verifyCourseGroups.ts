import "dotenv/config";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

import { POST as loginHandler } from "../app/api/auth/login/route";
import { POST as createProgramCourse } from "../app/api/programs/[id]/courses/route";
import {
  GET as getCourseGroups,
  POST as createCourseGroup,
} from "../app/api/courses/[id]/groups/route";
import {
  PATCH as updateCourseGroup,
  DELETE as deleteCourseGroup,
} from "../app/api/courses/[id]/groups/[groupId]/route";
import {
  GET as getStaffGroups,
  POST as assignStaffGroups,
} from "../app/api/staff/[id]/groups/route";
import {
  POST as assignStaffCourse,
  DELETE as unassignStaffCourse,
} from "../app/api/staff/[id]/courses/route";
import { POST as bulkUploadPreview } from "../app/api/programs/[id]/bulk-upload/route";
import { POST as bulkUploadCommit } from "../app/api/programs/[id]/bulk-upload/commit/route";
import { POST as markAttendance } from "../app/api/sessions/[id]/attendance/route";
import { POST as markAllPresent } from "../app/api/sessions/[id]/attendance/mark-all-present/route";
import { GET as getSessionAttendance } from "../app/api/sessions/[id]/attendance/route";

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
  const tag = `groups-test-${Date.now()}`;

  const createdProgramIds: string[] = [];
  const createdCourseIds: string[] = [];
  const createdGroupIds: string[] = [];
  const createdStaffIds: string[] = [];
  const createdParticipantIds: string[] = [];
  const createdSessionIds: string[] = [];

  try {
    console.log("=== COURSE GROUPS & SCOPING VERIFICATION SUITE ===");

    // Step 0: Auth Setup
    console.log("\n--- Step 0: Auth Setup ---");
    const { hashPassword } = await import("../lib/auth");

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

    // Create a test facilitator staff user
    const facilitatorUser = await prisma.staffUser.create({
      data: {
        full_name: `Facilitator Test ${tag}`,
        email: `facilitator_${tag}@test.com`,
        password_hash: hashPassword("facilitator123"),
        role: "facilitator",
      },
    });
    createdStaffIds.push(facilitatorUser.id);

    const facilitatorLoginRes = await loginHandler(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: `facilitator_${tag}@test.com`,
          password: "facilitator123",
        }),
      }) as never
    );
    assert.equal(facilitatorLoginRes.status, 200);
    const facilitatorCookie = extractCookieHeader(facilitatorLoginRes);
    assert(facilitatorCookie, "Facilitator cookie required");

    // Create test program
    const program = await prisma.program.create({
      data: { name: `Program Groups Test ${tag}`, status: "active" },
    });
    createdProgramIds.push(program.id);

    // Create Course 1 (Web Dev) and Course 2 (Data)
    const createCourseRes1 = await createProgramCourse(
      new Request(`http://localhost/api/programs/${program.id}/courses`, {
        method: "POST",
        headers: { Cookie: adminCookie, "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Web Development" }),
      }) as never,
      { params: Promise.resolve({ id: program.id }) }
    );
    assert.equal(createCourseRes1.status, 201);
    const course1 = (await responseJson<{ id: string; name: string }>(createCourseRes1)).data!;
    createdCourseIds.push(course1.id);

    const createCourseRes2 = await createProgramCourse(
      new Request(`http://localhost/api/programs/${program.id}/courses`, {
        method: "POST",
        headers: { Cookie: adminCookie, "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Data Analytics" }),
      }) as never,
      { params: Promise.resolve({ id: program.id }) }
    );
    assert.equal(createCourseRes2.status, 201);
    const course2 = (await responseJson<{ id: string; name: string }>(createCourseRes2)).data!;
    createdCourseIds.push(course2.id);

    // --- Section 1: Course Groups CRUD ---
    console.log("\n--- Section 1: Course Groups CRUD & Constraints ---");
    // 1.1 Create Group A in Course 1
    const createGroupResA = await createCourseGroup(
      new Request(`http://localhost/api/courses/${course1.id}/groups`, {
        method: "POST",
        headers: { Cookie: adminCookie, "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Group A" }),
      }) as never,
      { params: Promise.resolve({ id: course1.id }) }
    );
    assert.equal(createGroupResA.status, 201);
    const groupA = (await responseJson<{ id: string; name: string }>(createGroupResA)).data!;
    assert.equal(groupA.name, "Group A");
    createdGroupIds.push(groupA.id);

    // 1.2 Create Group B in Course 1
    const createGroupResB = await createCourseGroup(
      new Request(`http://localhost/api/courses/${course1.id}/groups`, {
        method: "POST",
        headers: { Cookie: adminCookie, "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Group B" }),
      }) as never,
      { params: Promise.resolve({ id: course1.id }) }
    );
    assert.equal(createGroupResB.status, 201);
    const groupB = (await responseJson<{ id: string; name: string }>(createGroupResB)).data!;
    createdGroupIds.push(groupB.id);

    // 1.3 Duplicate name rejection within course (case-insensitive)
    const dupGroupRes = await createCourseGroup(
      new Request(`http://localhost/api/courses/${course1.id}/groups`, {
        method: "POST",
        headers: { Cookie: adminCookie, "Content-Type": "application/json" },
        body: JSON.stringify({ name: "group a" }),
      }) as never,
      { params: Promise.resolve({ id: course1.id }) }
    );
    assert.equal(dupGroupRes.status, 409, "Should reject duplicate group name in same course");

    // 1.4 Rename Group
    const renameRes = await updateCourseGroup(
      new Request(`http://localhost/api/courses/${course1.id}/groups/${groupB.id}`, {
        method: "PATCH",
        headers: { Cookie: adminCookie, "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Group Beta" }),
      }) as never,
      { params: Promise.resolve({ id: course1.id, groupId: groupB.id }) }
    );
    assert.equal(renameRes.status, 200);
    const renamedGroup = (await responseJson<{ id: string; name: string }>(renameRes)).data!;
    assert.equal(renamedGroup.name, "Group Beta");

    // Change back to Group B for consistency
    await updateCourseGroup(
      new Request(`http://localhost/api/courses/${course1.id}/groups/${groupB.id}`, {
        method: "PATCH",
        headers: { Cookie: adminCookie, "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Group B" }),
      }) as never,
      { params: Promise.resolve({ id: course1.id, groupId: groupB.id }) }
    );

    // --- Section 1.5: RBAC Enforcement on Admin-Only Endpoints ---
    console.log("\n--- Section 1.5: RBAC Enforcement on Admin-Only Endpoints ---");
    // Facilitator calling POST /api/courses/:id/groups
    const facPostGroupRes = await createCourseGroup(
      new Request(`http://localhost/api/courses/${course1.id}/groups`, {
        method: "POST",
        headers: { Cookie: facilitatorCookie, "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Forbidden Group" }),
      }) as never,
      { params: Promise.resolve({ id: course1.id }) }
    );
    assert.equal(facPostGroupRes.status, 403, "POST /api/courses/:id/groups must return 403 for non-admin");

    // Facilitator calling PATCH /api/courses/:id/groups/:groupId
    const facPatchGroupRes = await updateCourseGroup(
      new Request(`http://localhost/api/courses/${course1.id}/groups/${groupA.id}`, {
        method: "PATCH",
        headers: { Cookie: facilitatorCookie, "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Forbidden Rename" }),
      }) as never,
      { params: Promise.resolve({ id: course1.id, groupId: groupA.id }) }
    );
    assert.equal(facPatchGroupRes.status, 403, "PATCH /api/courses/:id/groups/:groupId must return 403 for non-admin");

    // Facilitator calling DELETE /api/courses/:id/groups/:groupId
    const facDeleteGroupRes = await deleteCourseGroup(
      new Request(`http://localhost/api/courses/${course1.id}/groups/${groupA.id}`, {
        method: "DELETE",
        headers: { Cookie: facilitatorCookie },
      }) as never,
      { params: Promise.resolve({ id: course1.id, groupId: groupA.id }) }
    );
    assert.equal(facDeleteGroupRes.status, 403, "DELETE /api/courses/:id/groups/:groupId must return 403 for non-admin");

    // Facilitator calling POST /api/staff/:id/groups
    const facPostStaffGroupsRes = await assignStaffGroups(
      new Request(`http://localhost/api/staff/${facilitatorUser.id}/groups`, {
        method: "POST",
        headers: { Cookie: facilitatorCookie, "Content-Type": "application/json" },
        body: JSON.stringify({
          program_id: program.id,
          course_id: course1.id,
          group_ids: [groupA.id],
        }),
      }) as never,
      { params: Promise.resolve({ id: facilitatorUser.id }) }
    );
    assert.equal(facPostStaffGroupsRes.status, 403, "POST /api/staff/:id/groups must return 403 for non-admin");

    // --- Section 1.6: Group Deletion Cascade & Soft Unassignment ---
    console.log("\n--- Section 1.6: Group Deletion Cascade & Soft Unassignment ---");
    // Create a temporary group for deletion testing
    const createTempGroupRes = await createCourseGroup(
      new Request(`http://localhost/api/courses/${course1.id}/groups`, {
        method: "POST",
        headers: { Cookie: adminCookie, "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Group Temp Deletion" }),
      }) as never,
      { params: Promise.resolve({ id: course1.id }) }
    );
    assert.equal(createTempGroupRes.status, 201);
    const tempGroup = (await responseJson<{ id: string; name: string }>(createTempGroupRes)).data!;

    // Create participant and enrollment assigned to tempGroup
    const tempParticipant = await prisma.participant.create({
      data: {
        first_name: "Temp",
        last_name: "DeleteStudent",
        nin_number: `NIN-TEMP-${tag}`,
        full_name: "Temp DeleteStudent",
        email: `temp.${tag}@example.com`,
      },
    });
    createdParticipantIds.push(tempParticipant.id);

    const tempEnrollment = await prisma.enrollment.create({
      data: {
        participant_id: tempParticipant.id,
        program_id: program.id,
        course_id: course1.id,
        course_group_id: tempGroup.id,
        status: "registered",
      },
    });

    // Make sure facilitator is assigned to program & course, then assign to tempGroup
    const tempProgStaff = await prisma.programStaff.upsert({
      where: {
        staff_user_id_program_id: {
          staff_user_id: facilitatorUser.id,
          program_id: program.id,
        },
      },
      update: {},
      create: {
        staff_user_id: facilitatorUser.id,
        program_id: program.id,
      },
    });

    await prisma.facilitatorCourse.upsert({
      where: {
        program_staff_id_course_id: {
          program_staff_id: tempProgStaff.id,
          course_id: course1.id,
        },
      },
      update: {},
      create: {
        program_staff_id: tempProgStaff.id,
        course_id: course1.id,
      },
    });

    const tempFacGroup = await prisma.facilitatorGroup.create({
      data: {
        program_staff_id: tempProgStaff.id,
        course_group_id: tempGroup.id,
      },
    });

    // Verify initial state prior to deletion
    assert.equal(tempEnrollment.course_group_id, tempGroup.id);
    const facGroupBefore = await prisma.facilitatorGroup.findUnique({
      where: { id: tempFacGroup.id },
    });
    assert(facGroupBefore, "FacilitatorGroup row should exist prior to deletion");

    // Perform DELETE group as Admin
    const deleteGroupRes = await deleteCourseGroup(
      new Request(`http://localhost/api/courses/${course1.id}/groups/${tempGroup.id}`, {
        method: "DELETE",
        headers: { Cookie: adminCookie },
      }) as never,
      { params: Promise.resolve({ id: course1.id, groupId: tempGroup.id }) }
    );
    assert.equal(deleteGroupRes.status, 200, "Group deletion should succeed");

    // (a) Assert enrollment still exists, but course_group_id is now NULL
    const enrollmentAfter = await prisma.enrollment.findUnique({
      where: { id: tempEnrollment.id },
    });
    assert(enrollmentAfter, "Enrollment must NOT be deleted when group is deleted");
    assert.equal(enrollmentAfter.course_group_id, null, "Enrollment course_group_id must be null after group deletion");

    // (b) Assert FacilitatorGroup row is deleted
    const facGroupAfter = await prisma.facilitatorGroup.findUnique({
      where: { id: tempFacGroup.id },
    });
    assert.equal(facGroupAfter, null, "FacilitatorGroup row must be deleted via cascade when group is deleted");

    // Clean up temporary facilitator program staff for Section 1.6
    await prisma.facilitatorCourse.deleteMany({ where: { program_staff_id: tempProgStaff.id } });
    await prisma.programStaff.delete({ where: { id: tempProgStaff.id } });

    // --- Section 2: Facilitator/Course Cascade Integrity ---
    console.log("\n--- Section 2: Facilitator/Course Cascade Integrity ---");
    // 2.1 Attempt to assign group to facilitator before assigning to program/course -> should fail
    const assignGroupFailRes = await assignStaffGroups(
      new Request(`http://localhost/api/staff/${facilitatorUser.id}/groups`, {
        method: "POST",
        headers: { Cookie: adminCookie, "Content-Type": "application/json" },
        body: JSON.stringify({
          program_id: program.id,
          course_id: course1.id,
          group_ids: [groupA.id],
        }),
      }) as never,
      { params: Promise.resolve({ id: facilitatorUser.id }) }
    );
    assert.equal(assignGroupFailRes.status, 400, "Should reject group assignment without prior program assignment");

    // Assign facilitator to program
    const progStaff = await prisma.programStaff.create({
      data: {
        staff_user_id: facilitatorUser.id,
        program_id: program.id,
      },
    });

    // 2.2 Attempt to assign group before assigning to course track -> should fail
    const assignGroupFailRes2 = await assignStaffGroups(
      new Request(`http://localhost/api/staff/${facilitatorUser.id}/groups`, {
        method: "POST",
        headers: { Cookie: adminCookie, "Content-Type": "application/json" },
        body: JSON.stringify({
          program_id: program.id,
          course_id: course1.id,
          group_ids: [groupA.id],
        }),
      }) as never,
      { params: Promise.resolve({ id: facilitatorUser.id }) }
    );
    assert.equal(assignGroupFailRes2.status, 400, "Should reject group assignment without prior course track assignment");

    // Assign facilitator to course 1
    const assignCourseRes = await assignStaffCourse(
      new Request(`http://localhost/api/staff/${facilitatorUser.id}/courses`, {
        method: "POST",
        headers: { Cookie: adminCookie, "Content-Type": "application/json" },
        body: JSON.stringify({
          program_id: program.id,
          course_id: course1.id,
        }),
      }) as never,
      { params: Promise.resolve({ id: facilitatorUser.id }) }
    );
    assert.equal(assignCourseRes.status, 201);

    // 2.3 Assign facilitator to 2 groups (Group A and Group B)
    const assignGroupsSuccess = await assignStaffGroups(
      new Request(`http://localhost/api/staff/${facilitatorUser.id}/groups`, {
        method: "POST",
        headers: { Cookie: adminCookie, "Content-Type": "application/json" },
        body: JSON.stringify({
          program_id: program.id,
          course_id: course1.id,
          group_ids: [groupA.id, groupB.id],
        }),
      }) as never,
      { params: Promise.resolve({ id: facilitatorUser.id }) }
    );
    assert.equal(assignGroupsSuccess.status, 200);
    const assignedGroupsData = (await responseJson<Array<{ group_id: string }>>(assignGroupsSuccess)).data!;
    assert.equal(assignedGroupsData.length, 2);

    // 2.4 Unassigning course track cascades away facilitator_groups
    const unassignCourseRes = await unassignStaffCourse(
      new Request(
        `http://localhost/api/staff/${facilitatorUser.id}/courses?program_id=${program.id}&course_id=${course1.id}`,
        {
          method: "DELETE",
          headers: { Cookie: adminCookie },
        }
      ) as never,
      { params: Promise.resolve({ id: facilitatorUser.id }) }
    );
    assert.equal(unassignCourseRes.status, 200);

    const checkFacGroups = await prisma.facilitatorGroup.findMany({
      where: { program_staff_id: progStaff.id },
    });
    assert.equal(checkFacGroups.length, 0, "Facilitator groups should have cascaded away on course track unassignment");

    // Re-assign course and Group A + Group B for attendance testing
    await assignStaffCourse(
      new Request(`http://localhost/api/staff/${facilitatorUser.id}/courses`, {
        method: "POST",
        headers: { Cookie: adminCookie, "Content-Type": "application/json" },
        body: JSON.stringify({
          program_id: program.id,
          course_id: course1.id,
        }),
      }) as never,
      { params: Promise.resolve({ id: facilitatorUser.id }) }
    );
    await assignStaffGroups(
      new Request(`http://localhost/api/staff/${facilitatorUser.id}/groups`, {
        method: "POST",
        headers: { Cookie: adminCookie, "Content-Type": "application/json" },
        body: JSON.stringify({
          program_id: program.id,
          course_id: course1.id,
          group_ids: [groupA.id, groupB.id],
        }),
      }) as never,
      { params: Promise.resolve({ id: facilitatorUser.id }) }
    );

    // --- Section 3: Bulk Upload Normalization ---
    console.log("\n--- Section 3: Bulk Upload Normalization ---");
    // CSV with different casings and trailing spaces: "Group A", "group a", "Group A ", "GROUP B"
    const csvContent = [
      "first_name,last_name,nin_number,email,phone,course_name,group_name",
      `Alice,Smith,NIN-${tag}-1,alice.${tag}@example.com,+234800000001,Web Development,Group A`,
      `Bob,Jones,NIN-${tag}-2,bob.${tag}@example.com,+234800000002,Web Development,group a`,
      `Charlie,Brown,NIN-${tag}-3,charlie.${tag}@example.com,+234800000003,Web Development,"Group A "`,
      `David,Miller,NIN-${tag}-4,david.${tag}@example.com,+234800000004,Web Development,GROUP B`,
    ].join("\n");

    const previewRes = await bulkUploadPreview(
      new Request(`http://localhost/api/programs/${program.id}/bulk-upload`, {
        method: "POST",
        headers: { Cookie: adminCookie, "Content-Type": "application/json" },
        body: JSON.stringify({ csv_content: csvContent }),
      }) as never,
      { params: Promise.resolve({ id: program.id }) }
    );
    assert.equal(previewRes.status, 200);
    const previewJson = (await responseJson<{ new_participant_count: number; skipped_count: number; rows: Array<{ row_number: number; full_name: string; skip_reason: string; action: string }> }>(previewRes)).data!;
    assert.equal(previewJson.new_participant_count, 4);
    assert.equal(previewJson.skipped_count, 0);

    const commitRes = await bulkUploadCommit(
      new Request(`http://localhost/api/programs/${program.id}/bulk-upload/commit`, {
        method: "POST",
        headers: { Cookie: adminCookie, "Content-Type": "application/json" },
        body: JSON.stringify({ csv_content: csvContent }),
      }) as never,
      { params: Promise.resolve({ id: program.id }) }
    );
    assert.equal(commitRes.status, 200);
    const commitJson = (await responseJson<{ created_count: number; results: Array<{ participant_id: string }> }>(commitRes)).data!;
    assert.equal(commitJson.created_count, 4);
    commitJson.results.forEach((r) => {
      if (r.participant_id) createdParticipantIds.push(r.participant_id);
    });

    // Check course groups in database: should ONLY have Group A and Group B (no extra duplicate groups created)
    const course1Groups = await prisma.courseGroup.findMany({
      where: { course_id: course1.id },
    });
    assert.equal(course1Groups.length, 2, "Bulk upload must collapse case/whitespace variants into existing groups");

    // Verify enrollments assignments
    const enrollments = await prisma.enrollment.findMany({
      where: { program_id: program.id },
      include: { participant: true, course_group: true },
    });
    const aliceEnrollment = enrollments.find((e) => e.participant.email === `alice.${tag}@example.com`)!;
    const bobEnrollment = enrollments.find((e) => e.participant.email === `bob.${tag}@example.com`)!;
    const charlieEnrollment = enrollments.find((e) => e.participant.email === `charlie.${tag}@example.com`)!;
    const davidEnrollment = enrollments.find((e) => e.participant.email === `david.${tag}@example.com`)!;

    assert.equal(aliceEnrollment.course_group_id, groupA.id);
    assert.equal(bobEnrollment.course_group_id, groupA.id);
    assert.equal(charlieEnrollment.course_group_id, groupA.id);
    assert.equal(davidEnrollment.course_group_id, groupB.id);

    // --- Section 4: Mark-All-Present Clobber Protection & Group Scoping ---
    console.log("\n--- Section 4: Mark-All-Present Clobber Protection & Group Scoping ---");
    // Create a session
    const session = await prisma.session.create({
      data: {
        program_id: program.id,
        title: `Session 1 ${tag}`,
        session_date: new Date(),
        is_active: true,
      },
    });
    createdSessionIds.push(session.id);

    // 4.1 Explicitly mark Bob as 'absent' in Group A
    const markBobAbsentRes = await markAttendance(
      new Request(`http://localhost/api/sessions/${session.id}/attendance`, {
        method: "POST",
        headers: { Cookie: adminCookie, "Content-Type": "application/json" },
        body: JSON.stringify({
          records: [
            {
              enrollment_id: bobEnrollment.id,
              status: "absent",
            },
          ],
        }),
      }) as never,
      { params: Promise.resolve({ id: session.id }) }
    );
    assert.equal(markBobAbsentRes.status, 200);

    // 4.2 Run Mark All Present scoped to Group A
    const markAllGroupARes = await markAllPresent(
      new Request(`http://localhost/api/sessions/${session.id}/attendance/mark-all-present`, {
        method: "POST",
        headers: { Cookie: adminCookie, "Content-Type": "application/json" },
        body: JSON.stringify({
          course_id: course1.id,
          course_group_id: groupA.id,
        }),
      }) as never,
      { params: Promise.resolve({ id: session.id }) }
    );
    assert.equal(markAllGroupARes.status, 200);
    const markAllJson = (await responseJson<{
      marked_present: Array<{ enrollment_id: string }>;
      skipped_already_marked: Array<{ enrollment_id: string; status: string }>;
    }>(markAllGroupARes)).data!;

    // Assert that Bob was skipped (clobber protection) and stays 'absent'
    const bobSkipped = markAllJson.skipped_already_marked.find((r) => r.enrollment_id === bobEnrollment.id);
    assert(bobSkipped, "Bob must be skipped because he was already marked absent");

    // Verify Bob's actual record in DB is still absent
    const bobRecord = await prisma.attendanceRecord.findUnique({
      where: {
        session_id_enrollment_id: {
          session_id: session.id,
          enrollment_id: bobEnrollment.id,
        },
      },
    });
    assert.equal(bobRecord?.status, "absent", "Bob MUST remain 'absent' after mark-all-present");

    // Assert Alice & Charlie (in Group A) became 'present'
    const aliceRecord = await prisma.attendanceRecord.findUnique({
      where: {
        session_id_enrollment_id: {
          session_id: session.id,
          enrollment_id: aliceEnrollment.id,
        },
      },
    });
    assert.equal(aliceRecord?.status, "present", "Alice must be marked present");

    const charlieRecord = await prisma.attendanceRecord.findUnique({
      where: {
        session_id_enrollment_id: {
          session_id: session.id,
          enrollment_id: charlieEnrollment.id,
        },
      },
    });
    assert.equal(charlieRecord?.status, "present", "Charlie must be marked present");

    // Assert David (in Group B) was NOT touched / NOT marked
    const davidRecord = await prisma.attendanceRecord.findUnique({
      where: {
        session_id_enrollment_id: {
          session_id: session.id,
          enrollment_id: davidEnrollment.id,
        },
      },
    });
    assert.equal(davidRecord, null, "David (Group B) must remain unmarked when Mark All is scoped to Group A");

    console.log("\n>>> ALL AUTOMATED COURSE GROUPS TESTS PASSED! <<<");
  } finally {
    console.log("\n--- Cleanup / Teardown ---");
    // Clean up created resources in reverse dependency order
    for (const sid of createdSessionIds) {
      await prisma.attendanceRecord.deleteMany({ where: { session_id: sid } }).catch(() => {});
      await prisma.session.delete({ where: { id: sid } }).catch(() => {});
    }
    for (const pid of createdProgramIds) {
      await prisma.enrollment.deleteMany({ where: { program_id: pid } }).catch(() => {});
      await prisma.facilitatorGroup.deleteMany({
        where: { program_staff: { program_id: pid } },
      }).catch(() => {});
      await prisma.facilitatorCourse.deleteMany({
        where: { program_staff: { program_id: pid } },
      }).catch(() => {});
      await prisma.programStaff.deleteMany({ where: { program_id: pid } }).catch(() => {});
    }
    for (const cid of createdCourseIds) {
      await prisma.courseGroup.deleteMany({ where: { course_id: cid } }).catch(() => {});
      await prisma.course.delete({ where: { id: cid } }).catch(() => {});
    }
    for (const pid of createdProgramIds) {
      await prisma.program.delete({ where: { id: pid } }).catch(() => {});
    }
    for (const pid of createdParticipantIds) {
      await prisma.participant.delete({ where: { id: pid } }).catch(() => {});
    }
    for (const sid of createdStaffIds) {
      await prisma.staffUser.delete({ where: { id: sid } }).catch(() => {});
    }
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("FATAL TEST FAILURE:", err);
  process.exit(1);
});
