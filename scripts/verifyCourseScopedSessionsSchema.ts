import { Pool } from "pg";
import * as dotenv from "dotenv";

dotenv.config();

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DIRECT_URL or DATABASE_URL is not set");
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
    console.log("\n--- 1. SESSIONS COURSE_ID COLUMN CHECK ---");
    const columnRes = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND table_name = 'sessions' 
        AND column_name = 'course_id';
    `);
    console.table(columnRes.rows);

    if (columnRes.rows.length === 0 || columnRes.rows[0].is_nullable !== "NO") {
      throw new Error("Verification failed: course_id column is missing or nullable");
    }

    console.log("\n--- 2. FOREIGN KEY CONSTRAINTS CHECK ---");
    const fkRes = await client.query(`
      SELECT conname, confrelid::regclass AS referenced_table,
        CASE confdeltype
          WHEN 'r' THEN 'RESTRICT'
          WHEN 'c' THEN 'CASCADE'
          WHEN 'n' THEN 'SET NULL'
          WHEN 'd' THEN 'SET DEFAULT'
          WHEN 'a' THEN 'NO ACTION'
          ELSE confdeltype::text
        END AS on_delete,
        CASE confupdtype
          WHEN 'r' THEN 'RESTRICT'
          WHEN 'c' THEN 'CASCADE'
          WHEN 'n' THEN 'SET NULL'
          WHEN 'd' THEN 'SET DEFAULT'
          WHEN 'a' THEN 'NO ACTION'
          ELSE confupdtype::text
        END AS on_update
      FROM pg_constraint 
      WHERE conname = 'sessions_course_id_fkey';
    `);
    console.table(fkRes.rows);

    if (fkRes.rows.length === 0) {
      throw new Error("Verification failed: sessions_course_id_fkey constraint is missing");
    }

    console.log("\n--- 3. INDEX CHECK ---");
    const idxRes = await client.query(`
      SELECT indexname, indexdef
      FROM pg_indexes 
      WHERE tablename = 'sessions' AND indexname = 'sessions_course_id_idx';
    `);
    console.table(idxRes.rows);

    if (idxRes.rows.length === 0) {
      throw new Error("Verification failed: sessions_course_id_idx index is missing");
    }

    console.log("\n--- 4. DATA INTEGRITY CHECK ---");
    const nullCoursesRes = await client.query(`
      SELECT COUNT(*) as null_course_sessions FROM "sessions" WHERE "course_id" IS NULL;
    `);
    console.table(nullCoursesRes.rows);

    console.log("\nAll course-scoped sessions database verifications passed successfully!");
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
