import { Pool } from "pg";
import * as dotenv from "dotenv";

dotenv.config();

const connectionString = process.env.DATABASE_URL || process.env.DIRECT_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL or DIRECT_URL is not set");
}

function logDatabaseTarget(url?: string) {
  let host = "UNKNOWN";
  if (url) {
    try {
      host = new URL(url).host || url.match(/@([^/:]+)/)?.[1] || "UNKNOWN";
    } catch {
      const match = url.match(/@([^/:]+)/);
      if (match) host = match[1];
    }
  }
  console.log("======================================================================");
  console.log(`[ENVIRONMENT GUARD] Verified Database Host: ${host}`);
  console.log("======================================================================");
}

async function main() {
  logDatabaseTarget(connectionString);
  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  const client = await pool.connect();

  try {
    console.log("\n--- 1. TABLE EXISTENCE CHECK ---");
    const tablesRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name IN ('course_groups', 'facilitator_groups', 'enrollments', 'courses')
      ORDER BY table_name;
    `);
    console.table(tablesRes.rows);

    console.log("\n--- 2. ENROLLMENTS COURSE_GROUP_ID COLUMN CHECK ---");
    const columnRes = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND table_name = 'enrollments' 
        AND column_name = 'course_group_id';
    `);
    console.table(columnRes.rows);

    console.log("\n--- 3. FOREIGN KEY CONSTRAINTS CHECK ---");
    const fkRes = await client.query(`
      SELECT conname, confrelid::regclass AS referenced_table
      FROM pg_constraint 
      WHERE conname IN (
        'course_groups_course_id_fkey',
        'facilitator_groups_program_staff_id_fkey',
        'facilitator_groups_course_group_id_fkey',
        'enrollments_course_group_id_fkey'
      );
    `);
    console.table(fkRes.rows);

    console.log("\n--- 4. DATA INTEGRITY & ROW COUNTS ---");
    const enrollmentsCount = await client.query(`SELECT COUNT(*) as total_enrollments FROM "enrollments"`);
    const assignedGroupsCount = await client.query(`SELECT COUNT(*) as enrollments_with_group FROM "enrollments" WHERE "course_group_id" IS NOT NULL`);
    const courseGroupsCount = await client.query(`SELECT COUNT(*) as total_course_groups FROM "course_groups"`);
    const facilitatorGroupsCount = await client.query(`SELECT COUNT(*) as total_facilitator_groups FROM "facilitator_groups"`);

    console.log({
      total_enrollments: enrollmentsCount.rows[0].total_enrollments,
      enrollments_with_group: assignedGroupsCount.rows[0].enrollments_with_group,
      total_course_groups: courseGroupsCount.rows[0].total_course_groups,
      total_facilitator_groups: facilitatorGroupsCount.rows[0].total_facilitator_groups,
    });

  } catch (err) {
    console.error("Verification error:", err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
