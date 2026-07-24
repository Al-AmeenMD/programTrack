import "dotenv/config";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

import { POST as loginHandler } from "../app/api/auth/login/route";
import { GET as getTemplate, POST as createTemplate, PATCH as updateTemplate } from "../app/api/programs/[id]/form-template/route";
import { GET as getResponse, POST as submitResponse } from "../app/api/enrollments/[id]/form-response/route";
import { createOrEnrollParticipant } from "../lib/participants/createOrEnrollParticipant";

async function responseJson<T = unknown>(
  response: Response
): Promise<{
  data?: T;
  error?: string;
  warning?: string;
}> {
  return response.json() as Promise<{
    data?: T;
    error?: string;
    warning?: string;
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
  const tag = `phase5-${Date.now()}`;

  // Strict tracking of created entity IDs for cleanup
  const createdFormResponseIds: string[] = [];
  const createdFormTemplateIds: string[] = [];
  const createdEnrollmentIds: string[] = [];
  const createdParticipantIds: string[] = [];
  const createdProgramIds: string[] = [];

  try {
    console.log("--- Setup test admin, facilitator, assigned program A & unassigned program B ---");
    // Admin login
    const adminLoginRes = await loginHandler(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: "admin@developmenthub.org",
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
          email: "facilitator@developmenthub.org",
          password: "facilitator123",
        }),
      }) as never
    );
    assert.equal(facilitatorLoginRes.status, 200);
    const facilitatorCookie = extractCookieHeader(facilitatorLoginRes);
    assert(facilitatorCookie, "Facilitator cookie required");

    // Create target test program A (assigned to facilitator)
    const programA = await prisma.program.create({
      data: { name: `Assigned Program A ${tag}`, status: "active" },
    });
    createdProgramIds.push(programA.id);

    // Create unassigned test program B
    const programB = await prisma.program.create({
      data: { name: `Unassigned Program B ${tag}`, status: "active" },
    });
    createdProgramIds.push(programB.id);

    const facilitatorUser = await prisma.staffUser.findUniqueOrThrow({
      where: { email: "facilitator@developmenthub.org" },
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

    console.log("--- Test 1: Admin Creates Intake Form Template for Program A ---");
    const templateFields = [
      { label: "Prior Experience", field_type: "text", required: true },
      { label: "Employment Status", field_type: "select", required: true, options: ["Employed", "Unemployed", "Student"] },
      { label: "Expected Graduation Date", field_type: "date", required: false },
    ];

    const createTemplateRes = await createTemplate(
      new Request(`http://localhost/api/programs/${programA.id}/form-template`, {
        method: "POST",
        headers: { Cookie: adminCookie },
        body: JSON.stringify({
          name: "Program A Intake Questionnaire",
          fields: templateFields,
        }),
      }) as never,
      { params: Promise.resolve({ id: programA.id }) }
    );
    assert.equal(createTemplateRes.status, 201);
    const templateData = (await responseJson<{ id: string; name: string }>(createTemplateRes)).data!;
    assert(templateData.id);
    createdFormTemplateIds.push(templateData.id);
    console.log("PASS: Admin created intake form template with 3 fields");

    console.log("--- Test 2: Creating a second intake template for same program returns 409 ---");
    const duplicateTemplateRes = await createTemplate(
      new Request(`http://localhost/api/programs/${programA.id}/form-template`, {
        method: "POST",
        headers: { Cookie: adminCookie },
        body: JSON.stringify({
          name: "Duplicate Intake Form",
          fields: templateFields,
        }),
      }) as never,
      { params: Promise.resolve({ id: programA.id }) }
    );
    assert.equal(duplicateTemplateRes.status, 409);
    console.log("PASS: Duplicate template creation rejected with 409 Conflict");

    console.log("--- Test 3: Template RBAC (Facilitator GET allowed on assigned, 403 on unassigned & POST/PATCH) ---");
    const facGetAssignedRes = await getTemplate(
      new Request(`http://localhost/api/programs/${programA.id}/form-template`, {
        headers: { Cookie: facilitatorCookie },
      }) as never,
      { params: Promise.resolve({ id: programA.id }) }
    );
    assert.equal(facGetAssignedRes.status, 200);

    const facGetUnassignedRes = await getTemplate(
      new Request(`http://localhost/api/programs/${programB.id}/form-template`, {
        headers: { Cookie: facilitatorCookie },
      }) as never,
      { params: Promise.resolve({ id: programB.id }) }
    );
    assert.equal(facGetUnassignedRes.status, 403);

    const facPostRes = await createTemplate(
      new Request(`http://localhost/api/programs/${programB.id}/form-template`, {
        method: "POST",
        headers: { Cookie: facilitatorCookie },
        body: JSON.stringify({ name: "Facilitator Form", fields: templateFields }),
      }) as never,
      { params: Promise.resolve({ id: programB.id }) }
    );
    assert.equal(facPostRes.status, 403);
    console.log("PASS: Template RBAC correctly enforced");

    console.log("--- Test 4: Enrollment Integration Surfaces has_intake_form ---");
    const enrollResult = await createOrEnrollParticipant(
      {
        full_name: "Intake Test Participant",
        email: `intake-${tag}@example.com`,
      },
      programA.id
    );
    createdParticipantIds.push(enrollResult.participant.id);
    if (enrollResult.enrollment) {
      createdEnrollmentIds.push(enrollResult.enrollment.id);
    }
    assert.equal(enrollResult.has_intake_form, true);
    assert.equal(enrollResult.form_template_id, templateData.id);
    console.log("PASS: Enrollment surfaces has_intake_form: true and form_template_id");

    console.log("--- Test 5: Submitting Form Response Missing Required Field Returns 400 ---");
    const enrollmentId = enrollResult.enrollment!.id;
    const invalidSubmitRes = await submitResponse(
      new Request(`http://localhost/api/enrollments/${enrollmentId}/form-response`, {
        method: "POST",
        headers: { Cookie: adminCookie },
        body: JSON.stringify({
          answers: {
            "Employment Status": "Student",
            // "Prior Experience" required text field is missing
          },
        }),
      }) as never,
      { params: Promise.resolve({ id: enrollmentId }) }
    );
    assert.equal(invalidSubmitRes.status, 400);
    const invalidData = await responseJson(invalidSubmitRes);
    assert(invalidData.error?.includes("required"));
    console.log("PASS: Response missing required field rejected with 400");

    console.log("--- Test 6: Valid Form Response Submission & GET Retrieval ---");
    const validSubmitRes = await submitResponse(
      new Request(`http://localhost/api/enrollments/${enrollmentId}/form-response`, {
        method: "POST",
        headers: { Cookie: adminCookie },
        body: JSON.stringify({
          answers: {
            "Prior Experience": "1 year of SQL and Python",
            "Employment Status": "Student",
            "Expected Graduation Date": "2026-12-01",
          },
        }),
      }) as never,
      { params: Promise.resolve({ id: enrollmentId }) }
    );
    assert.equal(validSubmitRes.status, 201);
    const responseData = (await responseJson<{ id: string; answers: Record<string, unknown> }>(validSubmitRes)).data!;
    assert(responseData.id);
    createdFormResponseIds.push(responseData.id);

    const getResponseRes = await getResponse(
      new Request(`http://localhost/api/enrollments/${enrollmentId}/form-response`, {
        headers: { Cookie: adminCookie },
      }) as never,
      { params: Promise.resolve({ id: enrollmentId }) }
    );
    assert.equal(getResponseRes.status, 200);
    const fetchedResponse = (await responseJson<{ id: string; answers: Record<string, unknown> }>(getResponseRes)).data!;
    assert.equal(fetchedResponse.id, responseData.id);
    assert.equal(fetchedResponse.answers["Prior Experience"], "1 year of SQL and Python");
    console.log("PASS: Valid form response submitted and retrievable via GET");

    console.log("--- Test 7: PATCH Template Returns Warning Message when Responses Exist ---");
    const patchTemplateRes = await updateTemplate(
      new Request(`http://localhost/api/programs/${programA.id}/form-template`, {
        method: "PATCH",
        headers: { Cookie: adminCookie },
        body: JSON.stringify({
          name: "Updated Intake Questionnaire Title",
        }),
      }) as never,
      { params: Promise.resolve({ id: programA.id }) }
    );
    assert.equal(patchTemplateRes.status, 200);
    const patchJson = await responseJson<{ id: string }>(patchTemplateRes);
    assert(patchJson.warning, "Warning must be returned when editing template with existing responses");
    assert(patchJson.warning.includes("existing response(s)"));
    console.log(`PASS: PATCH template returned expected warning: "${patchJson.warning}"`);

    console.log("--- Test 8: Facilitator Submitting Response for Unassigned Program Enrollment Returns 403 ---");
    // Create enrollment in unassigned Program B
    const partUnassigned = await prisma.participant.create({
      data: { full_name: "Unassigned Participant", email: `unassigned-${tag}@example.com` },
    });
    createdParticipantIds.push(partUnassigned.id);

    const enrollUnassigned = await prisma.enrollment.create({
      data: { participant_id: partUnassigned.id, program_id: programB.id, status: "active" },
    });
    createdEnrollmentIds.push(enrollUnassigned.id);

    // Create intake template for Program B
    const templateB = await prisma.formTemplate.create({
      data: {
        program_id: programB.id,
        name: "Program B Intake",
        type: "intake",
        fields: [{ label: "Feedback", field_type: "text", required: false }],
      },
    });
    createdFormTemplateIds.push(templateB.id);

    const facSubmitUnassignedRes = await submitResponse(
      new Request(`http://localhost/api/enrollments/${enrollUnassigned.id}/form-response`, {
        method: "POST",
        headers: { Cookie: facilitatorCookie },
        body: JSON.stringify({ answers: { Feedback: "Test" } }),
      }) as never,
      { params: Promise.resolve({ id: enrollUnassigned.id }) }
    );
    assert.equal(facSubmitUnassignedRes.status, 403);
    console.log("PASS: Facilitator submitting response for unassigned program enrollment blocked with 403");

    console.log("Phase 5 verification passed successfully");
  } finally {
    console.log("--- Cleanup: Strictly deleting ONLY exact created test IDs ---");
    if (createdFormResponseIds.length > 0) {
      await prisma.formResponse.deleteMany({
        where: { id: { in: createdFormResponseIds } },
      });
    }
    if (createdFormTemplateIds.length > 0) {
      await prisma.formTemplate.deleteMany({
        where: { id: { in: createdFormTemplateIds } },
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
    if (createdProgramIds.length > 0) {
      await prisma.programStaff.deleteMany({
        where: { program_id: { in: createdProgramIds } },
      });
      await prisma.program.deleteMany({
        where: { id: { in: createdProgramIds } },
      });
    }

    // Empirical before/after row count assertion
    const remainingPrograms = await prisma.program.count({
      where: { id: { in: createdProgramIds } },
    });
    const remainingParticipants = await prisma.participant.count({
      where: { id: { in: createdParticipantIds } },
    });
    const remainingTemplates = await prisma.formTemplate.count({
      where: { id: { in: createdFormTemplateIds } },
    });
    const remainingResponses = await prisma.formResponse.count({
      where: { id: { in: createdFormResponseIds } },
    });

    assert.equal(remainingPrograms, 0, "Empirical check: 0 test programs must remain");
    assert.equal(remainingParticipants, 0, "Empirical check: 0 test participants must remain");
    assert.equal(remainingTemplates, 0, "Empirical check: 0 test form templates must remain");
    assert.equal(remainingResponses, 0, "Empirical check: 0 test form responses must remain");

    await prisma.$disconnect();
    await pool.end();
    console.log("PASS: Empirical cleanup check confirmed 0 leftover test records in DB");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
