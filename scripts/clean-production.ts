import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import bcrypt from "bcryptjs";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const ADMIN_ID = "13052baf-bb0b-4fdd-bf38-ec98e1fa2739";

async function main() {
  console.log("=== STARTING PRODUCTION DATABASE CLEANUP ===");
  console.log("Wiping all test data while preserving only the primary Admin User...");

  // 1. Delete dependent transactional records
  const attendance = await prisma.attendanceRecord.deleteMany({});
  console.log(`Deleted ${attendance.count} attendance records.`);

  const responses = await prisma.formResponse.deleteMany({});
  console.log(`Deleted ${responses.count} form responses.`);

  const certificates = await prisma.certificate.deleteMany({});
  console.log(`Deleted ${certificates.count} certificates.`);

  // 2. Delete enrollments
  const enrollments = await prisma.enrollment.deleteMany({});
  console.log(`Deleted ${enrollments.count} enrollments.`);

  // 3. Delete staff assignments & sessions
  const fc = await prisma.facilitatorCourse.deleteMany({});
  console.log(`Deleted ${fc.count} facilitator course assignments.`);

  const ps = await prisma.programStaff.deleteMany({});
  console.log(`Deleted ${ps.count} program staff links.`);

  const sessions = await prisma.session.deleteMany({});
  console.log(`Deleted ${sessions.count} sessions.`);

  const courses = await prisma.course.deleteMany({});
  console.log(`Deleted ${courses.count} courses.`);

  const templates = await prisma.formTemplate.deleteMany({});
  console.log(`Deleted ${templates.count} form templates.`);

  // 4. Delete programs & participants
  const programs = await prisma.program.deleteMany({});
  console.log(`Deleted ${programs.count} programs.`);

  const participants = await prisma.participant.deleteMany({});
  console.log(`Deleted ${participants.count} participants.`);

  // 5. Delete non-admin staff accounts
  const deletedStaff = await prisma.staffUser.deleteMany({
    where: {
      email: { notIn: ["admin@developmenthub.ng"] },
    },
  });
  console.log(`Deleted ${deletedStaff.count} non-admin staff users.`);

  // 6. Upsert Primary Admin User
  const adminPasswordHash = bcrypt.hashSync("admin123", 10);
  const adminUser = await prisma.staffUser.upsert({
    where: { id: ADMIN_ID },
    update: {
      full_name: "Admin User",
      email: "admin@developmenthub.ng",
      password_hash: adminPasswordHash,
      role: "admin",
      status: "active",
    },
    create: {
      id: ADMIN_ID,
      full_name: "Admin User",
      email: "admin@developmenthub.ng",
      password_hash: adminPasswordHash,
      role: "admin",
      status: "active",
    },
  });

  console.log("\n=== PRODUCTION CLEANUP SUCCESSFUL ===");
  console.log("Database state summary:");
  console.log({
    admin_account: `${adminUser.email} (${adminUser.role})`,
    remaining_staff: await prisma.staffUser.count(),
    remaining_participants: await prisma.participant.count(),
    remaining_programs: await prisma.program.count(),
    remaining_enrollments: await prisma.enrollment.count(),
    remaining_sessions: await prisma.session.count(),
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
    await pool.end();
  })
  .catch(async (error) => {
    console.error("Cleanup failed:", error);
    await prisma.$disconnect();
    await pool.end();
    process.exit(1);
  });
