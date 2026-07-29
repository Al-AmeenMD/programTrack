import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

async function main() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  console.log("--- Cleaning up all test programs, participants, and staff ---");

  // Identify test programs
  const testPrograms = await prisma.program.findMany({
    where: {
      OR: [
        { name: { contains: "phase" } },
        { name: { contains: "Temp Program" } },
        { name: { contains: "Target Program" } },
        { name: { contains: "Unassigned Program" } },
        { name: { contains: "Assigned Program" } },
      ],
    },
    select: { id: true, name: true },
  });
  const testProgramIds = testPrograms.map((p) => p.id);
  console.log(`Found ${testProgramIds.length} test program(s):`, testPrograms.map((p) => p.name));

  // Identify test participants
  const testParticipants = await prisma.participant.findMany({
    where: {
      OR: [
        { email: { contains: "phase" } },
        { email: { contains: "test" } },
        { full_name: { contains: "Participant" } },
      ],
      NOT: {
        email: {
          in: [
            "amina.yusuf@example.com",
            "musa.bello@example.com",
            "zainab.ali@example.com",
            "halima.bala@example.com",
            "ibrahim.suleiman@example.com",
            "kabir.danladi@example.com",
          ],
        },
      },
    },
    select: { id: true, email: true },
  });
  const testParticipantIds = testParticipants.map((p) => p.id);
  console.log(`Found ${testParticipantIds.length} test participant(s)`);

  // Identify test staff users (excluding seeded admin and facilitator)
  const testStaff = await prisma.staffUser.findMany({
    where: {
      email: {
        notIn: ["admin@programtrack.ng", "facilitator@programtrack.ng"],
      },
    },
    select: { id: true, email: true },
  });
  const testStaffIds = testStaff.map((s) => s.id);
  console.log(`Found ${testStaffIds.length} test staff user(s)`);

  // Foreign key cascade deletion in proper dependency order
  // 1. Form responses
  const deletedResponses = await prisma.formResponse.deleteMany({
    where: {
      OR: [
        { form_template: { program_id: { in: testProgramIds } } },
        { enrollment: { program_id: { in: testProgramIds } } },
        { enrollment: { participant_id: { in: testParticipantIds } } },
      ],
    },
  });
  console.log(`Deleted ${deletedResponses.count} form responses`);

  // 2. Form templates
  const deletedTemplates = await prisma.formTemplate.deleteMany({
    where: { program_id: { in: testProgramIds } },
  });
  console.log(`Deleted ${deletedTemplates.count} form templates`);

  // 3. ProgramStaff links
  const deletedStaffLinks = await prisma.programStaff.deleteMany({
    where: {
      OR: [
        { program_id: { in: testProgramIds } },
        { staff_user_id: { in: testStaffIds } },
      ],
    },
  });
  console.log(`Deleted ${deletedStaffLinks.count} program staff links`);

  // 4. Enrollments
  const deletedEnrollments = await prisma.enrollment.deleteMany({
    where: {
      OR: [
        { program_id: { in: testProgramIds } },
        { participant_id: { in: testParticipantIds } },
      ],
    },
  });
  console.log(`Deleted ${deletedEnrollments.count} enrollments`);

  // 5. Participants
  if (testParticipantIds.length > 0) {
    const deletedParticipants = await prisma.participant.deleteMany({
      where: { id: { in: testParticipantIds } },
    });
    console.log(`Deleted ${deletedParticipants.count} participants`);
  }

  // 6. Programs
  if (testProgramIds.length > 0) {
    const deletedPrograms = await prisma.program.deleteMany({
      where: { id: { in: testProgramIds } },
    });
    console.log(`Deleted ${deletedPrograms.count} programs`);
  }

  // 7. Staff users
  if (testStaffIds.length > 0) {
    const deletedStaff = await prisma.staffUser.deleteMany({
      where: { id: { in: testStaffIds } },
    });
    console.log(`Deleted ${deletedStaff.count} staff users`);
  }

  await prisma.$disconnect();
  await pool.end();
  console.log("--- Cleanup complete ---");
}

main().catch(console.error);
