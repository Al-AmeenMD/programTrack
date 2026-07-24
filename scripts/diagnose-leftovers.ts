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

  const programs = await prisma.program.findMany({
    select: { id: true, name: true, created_at: true },
    orderBy: { created_at: "asc" },
  });

  const participants = await prisma.participant.findMany({
    select: { id: true, full_name: true, email: true },
  });

  const staff = await prisma.staffUser.findMany({
    select: { id: true, full_name: true, email: true, role: true },
  });

  console.log("=== PROGRAMS IN DB ===");
  console.table(programs);

  console.log("=== PARTICIPANTS IN DB ===");
  console.table(participants);

  console.log("=== STAFF IN DB ===");
  console.table(staff);

  await prisma.$disconnect();
  await pool.end();
}

main().catch(console.error);
