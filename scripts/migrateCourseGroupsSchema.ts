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
  console.log(`[ENVIRONMENT GUARD] Target Database Host: ${host}`);
  console.log("======================================================================");
}

async function main() {
  logDatabaseTarget(connectionString);
  console.log("Connecting to PostgreSQL to apply Course Groups migration...");
  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    console.log("Creating course_groups table if not exists...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS "course_groups" (
        "id" UUID NOT NULL DEFAULT gen_random_uuid(),
        "course_id" UUID NOT NULL,
        "name" TEXT NOT NULL,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "course_groups_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "course_groups_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE
      );
    `);

    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "course_groups_course_id_name_key" ON "course_groups"("course_id", "name");
      CREATE INDEX IF NOT EXISTS "course_groups_course_id_idx" ON "course_groups"("course_id");
    `);

    console.log("Creating facilitator_groups table if not exists...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS "facilitator_groups" (
        "id" UUID NOT NULL DEFAULT gen_random_uuid(),
        "program_staff_id" UUID NOT NULL,
        "course_group_id" UUID NOT NULL,
        CONSTRAINT "facilitator_groups_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "facilitator_groups_program_staff_id_fkey" FOREIGN KEY ("program_staff_id") REFERENCES "program_staff"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT "facilitator_groups_course_group_id_fkey" FOREIGN KEY ("course_group_id") REFERENCES "course_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE
      );
    `);

    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "facilitator_groups_program_staff_id_course_group_id_key" ON "facilitator_groups"("program_staff_id", "course_group_id");
    `);

    console.log("Adding course_group_id to enrollments...");
    await client.query(`
      ALTER TABLE "enrollments" ADD COLUMN IF NOT EXISTS "course_group_id" UUID;
    `);

    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'enrollments_course_group_id_fkey'
        ) THEN
          ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_course_group_id_fkey" FOREIGN KEY ("course_group_id") REFERENCES "course_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;
        END IF;
      END $$;
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS "enrollments_course_group_id_idx" ON "enrollments"("course_group_id");
    `);

    await client.query("COMMIT");
    console.log("Course Groups migration completed successfully!");
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
