import { Pool } from "pg";
import * as dotenv from "dotenv";

dotenv.config();

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;

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
  console.log("Connecting to PostgreSQL to migrate enrollment status default to 'active'...");
  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // 1. Inspect existing registered enrollments
    const beforeCountRes = await client.query(`
      SELECT COUNT(*)::int AS count FROM "enrollments" WHERE "status" = 'registered';
    `);
    const registeredCountBefore = beforeCountRes.rows[0]?.count ?? 0;
    console.log(`Found ${registeredCountBefore} enrollments currently with status = 'registered'.`);

    // 2. Update existing registered enrollments to active
    if (registeredCountBefore > 0) {
      console.log("Updating existing 'registered' enrollments to 'active'...");
      const updateRes = await client.query(`
        UPDATE "enrollments"
        SET "status" = 'active', "updated_at" = CURRENT_TIMESTAMP
        WHERE "status" = 'registered';
      `);
      console.log(`Successfully updated ${updateRes.rowCount} enrollments to 'active'.`);
    } else {
      console.log("No enrollments need status conversion.");
    }

    // 3. Alter table default value for future inserts
    console.log("Altering column default for enrollments.status to 'active'...");
    await client.query(`
      ALTER TABLE "enrollments" ALTER COLUMN "status" SET DEFAULT 'active'::"EnrollmentStatus";
    `);

    // 4. Verification check
    const verifyRes = await client.query(`
      SELECT "status", COUNT(*)::int AS count FROM "enrollments" GROUP BY "status";
    `);
    console.log("Enrollment status distribution after migration:");
    for (const row of verifyRes.rows) {
      console.log(` - ${row.status}: ${row.count}`);
    }

    await client.query("COMMIT");
    console.log("Migration completed successfully and transaction committed.");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Migration failed, transaction rolled back:", err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
