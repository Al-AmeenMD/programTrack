import "dotenv/config";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { GET as getParticipants } from "../app/api/participants/route";
import { GET as getProgramEnrollments } from "../app/api/programs/[id]/enrollments/route";
import { GET as getPrograms } from "../app/api/programs/route";
import { DELETE as deleteProgram } from "../app/api/programs/[id]/route";
import { createOrEnrollParticipant } from "../lib/participants/createOrEnrollParticipant";

async function responseJson(response: Response) {
  return response.json() as Promise<{
    data: unknown;
    meta?: { page: number; pageSize: number; total: number };
  }>;
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
  const tag = `phase2-${Date.now()}`;
  const email = `${tag}@example.com`;

  try {
    const activeProgram = await prisma.program.findFirst({
      where: { status: "active" },
    });
    const upcomingProgram = await prisma.program.findFirst({
      where: { status: "upcoming" },
    });

    assert(activeProgram, "Seed active program was not found");
    assert(upcomingProgram, "Seed upcoming program was not found");

    const first = await createOrEnrollParticipant(
      {
        full_name: "Phase Two Tester",
        email,
        phone: `+2349${Date.now().toString().slice(-9)}`,
        metadata: { source: tag },
      },
      activeProgram.id
    );

    assert.equal(first.wasNewParticipant, true);
    assert.equal(first.wasNewEnrollment, true);

    const second = await createOrEnrollParticipant(
      {
        full_name: "Should Reuse Existing",
        email,
        metadata: { source: tag },
      },
      upcomingProgram.id
    );

    assert.equal(second.participant.id, first.participant.id);
    assert.equal(second.wasNewParticipant, false);
    assert.equal(second.wasNewEnrollment, true);

    const third = await createOrEnrollParticipant(
      {
        full_name: "Already Enrolled Check",
        email,
        metadata: { source: tag },
      },
      upcomingProgram.id
    );

    assert.equal(third.participant.id, first.participant.id);
    assert.equal(third.enrollment?.id, second.enrollment?.id);
    assert.equal(third.wasNewParticipant, false);
    assert.equal(third.wasNewEnrollment, false);

    const enrollmentsBeforeSoftDelete = await prisma.enrollment.count({
      where: { participant_id: first.participant.id },
    });

    await prisma.participant.update({
      where: { id: first.participant.id },
      data: { status: "inactive" },
    });

    const softDeletedParticipant = await prisma.participant.findUniqueOrThrow({
      where: { id: first.participant.id },
      include: { enrollments: true },
    });

    assert.equal(softDeletedParticipant.status, "inactive");
    assert.equal(softDeletedParticipant.enrollments.length, enrollmentsBeforeSoftDelete);

    let duplicateEnrollmentFailed = false;
    try {
      await prisma.enrollment.create({
        data: {
          participant_id: first.participant.id,
          program_id: upcomingProgram.id,
        },
      });
    } catch {
      duplicateEnrollmentFailed = true;
    }
    assert.equal(duplicateEnrollmentFailed, true);

    let duplicateEmailFailed = false;
    try {
      await prisma.participant.create({
        data: {
          full_name: "Duplicate Email Check",
          email,
        },
      });
    } catch {
      duplicateEmailFailed = true;
    }
    assert.equal(duplicateEmailFailed, true);

    const nullEmailA = await prisma.participant.create({
      data: {
        full_name: "Null Email A",
        phone: `+2348${Date.now().toString().slice(-9)}`,
        email: null,
        status: "inactive",
      },
    });
    const nullEmailB = await prisma.participant.create({
      data: {
        full_name: "Null Email B",
        phone: `+2347${Date.now().toString().slice(-9)}`,
        email: null,
        status: "inactive",
      },
    });
    assert(nullEmailA.id);
    assert(nullEmailB.id);

    const participantsList = await responseJson(
      await getParticipants(
        new Request("http://localhost/api/participants?page=1&pageSize=2") as never
      )
    );
    assert.equal(participantsList.meta?.page, 1);
    assert.equal(participantsList.meta?.pageSize, 2);
    assert(
      (participantsList.data as Array<{ status: string }>).every((participant) => {
        return participant.status === "active";
      })
    );

    const programsList = await responseJson(
      await getPrograms(
        new Request("http://localhost/api/programs?page=1&pageSize=10") as never
      )
    );
    assert(
      (programsList.data as Array<{ status: string }>).every((program) => {
        return program.status !== "cancelled";
      })
    );

    // --- Program Soft Delete Verification ---
    const tempProgram = await prisma.program.create({
      data: {
        name: `Temp Program ${tag}`,
        status: "active",
      },
    });

    const tempParticipant = await prisma.participant.create({
      data: {
        full_name: "Temp Participant",
        email: `temp-${tag}@example.com`,
      },
    });

    const tempEnrollment = await prisma.enrollment.create({
      data: {
        participant_id: tempParticipant.id,
        program_id: tempProgram.id,
        status: "active",
      },
    });

    // Call DELETE handler for program
    const deleteRes = await responseJson(
      await deleteProgram(
        new Request(`http://localhost/api/programs/${tempProgram.id}`) as never,
        { params: Promise.resolve({ id: tempProgram.id }) }
      )
    );
    const deletedProgramData = deleteRes.data as { id: string; status: string };

    // Assert status is 'cancelled', NOT 'completed'
    assert.equal(deletedProgramData.status, "cancelled");
    assert.notEqual(deletedProgramData.status, "completed");

    // Assert program is excluded from default GET list
    const defaultProgramsListAfterDelete = await responseJson(
      await getPrograms(
        new Request("http://localhost/api/programs?page=1&pageSize=100") as never
      )
    );
    const foundDeletedProgram = (
      defaultProgramsListAfterDelete.data as Array<{ id: string }>
    ).find((p) => p.id === tempProgram.id);
    assert.equal(foundDeletedProgram, undefined, "Cancelled program should be excluded from default GET list");

    // Assert enrollments tied to the deleted program still exist
    const tiedEnrollment = await prisma.enrollment.findUnique({
      where: { id: tempEnrollment.id },
    });
    assert(tiedEnrollment, "Enrollment tied to soft-deleted program must still exist");
    assert.equal(tiedEnrollment.status, "active");

    const enrollmentList = await responseJson(
      await getProgramEnrollments(
        new Request(
          `http://localhost/api/programs/${activeProgram.id}/enrollments?page=1&pageSize=2`
        ) as never,
        { params: Promise.resolve({ id: activeProgram.id }) }
      )
    );
    assert.equal(enrollmentList.meta?.page, 1);
    assert.equal(enrollmentList.meta?.pageSize, 2);
    assert(
      (enrollmentList.data as Array<{ status: string }>).every((enrollment) => {
        return enrollment.status !== "dropped";
      })
    );

    console.log("Phase 2 verification passed including program soft delete fix");
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
