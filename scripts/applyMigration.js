const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { Pool } = require("pg");
require("dotenv").config();

const migrationName = "20260720120000_init";
const migrationPath = path.join(
  process.cwd(),
  "prisma",
  "migrations",
  migrationName,
  "migration.sql"
);

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set");
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  const client = await pool.connect();

  try {
    const migrationSql = fs.readFileSync(migrationPath, "utf8");
    const checksum = crypto
      .createHash("sha256")
      .update(migrationSql)
      .digest("hex");

    await client.query("begin");
    await client.query(`
      create table if not exists "_prisma_migrations" (
        id varchar(36) primary key,
        checksum varchar(64) not null,
        finished_at timestamptz,
        migration_name varchar(255) not null,
        logs text,
        rolled_back_at timestamptz,
        started_at timestamptz not null default now(),
        applied_steps_count integer not null default 0
      )
    `);

    const existing = await client.query(
      'select id from "_prisma_migrations" where migration_name = $1 and rolled_back_at is null',
      [migrationName]
    );

    if (existing.rowCount > 0) {
      await client.query("commit");
      console.log(`${migrationName} is already recorded as applied`);
      return;
    }

    await client.query(migrationSql);
    await client.query(
      `insert into "_prisma_migrations"
        (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
       values ($1, $2, now(), $3, null, null, now(), 1)`,
      [crypto.randomUUID(), checksum, migrationName]
    );
    await client.query("commit");
    console.log(`${migrationName} applied successfully`);
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
