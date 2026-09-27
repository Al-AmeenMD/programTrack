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
  console.log(`[ENVIRONMENT GUARD] Target Database Host: ${host}`);
  console.log("======================================================================");
}

async function main() {
  logDatabaseTarget(connectionString);
  console.log("Connecting to PostgreSQL to apply Course-Scoped Sessions migration...");
  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Step 1: Add course_id column as NULLABLE first
    console.log("Adding nullable course_id column to sessions if not exists...");
    await client.query(`
      ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "course_id" UUID;
    `);

    // Step 2: Delete legacy session(s) where course_id IS NULL
    console.log("Cleaning up legacy sessions where course_id IS NULL...");
    const deletedAttendance = await client.query(`
      DELETE FROM "attendance_records" 
      WHERE "session_id" IN (SELECT "id" FROM "sessions" WHERE "course_id" IS NULL)
      RETURNING id;
    `);
    console.log(`Deleted ${deletedAttendance.rowCount ?? 0} orphaned attendance record(s).`);

    const deletedSessions = await client.query(`
      DELETE FROM "sessions" 
      WHERE "course_id" IS NULL
      RETURNING id;
    `);
    console.log(`Deleted ${deletedSessions.rowCount ?? 0} legacy session(s) lacking course_id.`);

    // Step 3: Enforce NOT NULL constraint
    console.log("Setting course_id column to NOT NULL...");
    await client.query(`
      ALTER TABLE "sessions" ALTER COLUMN "course_id" SET NOT NULL;
    `);

    // Step 4: Add Foreign Key constraint to courses
    console.log("Adding foreign key constraint sessions_course_id_fkey...");
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'sessions_course_id_fkey'
        ) THEN
          ALTER TABLE "sessions" 
            ADD CONSTRAINT "sessions_course_id_fkey" 
            FOREIGN KEY ("course_id") 
            REFERENCES "courses"("id") 
            ON DELETE RESTRICT 
            ON UPDATE CASCADE;
        END IF;
      END $$;
    `);

    // Step 5: Create Index on course_id
    console.log("Creating index sessions_course_id_idx on sessions(course_id)...");
    await client.query(`
      CREATE INDEX IF NOT EXISTS "sessions_course_id_idx" ON "sessions"("course_id");
    `);

    await client.query("COMMIT");
    console.log("Course-Scoped Sessions migration completed successfully!");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Migration error:", err);
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
