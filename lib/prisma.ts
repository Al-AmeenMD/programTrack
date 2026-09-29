import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

function extractHost(url?: string): string {
  if (!url) return "UNDEFINED";
  try {
    const match = url.match(/@([^/:]+)(?::(\d+))?/);
    if (match) {
      return match[2] ? `${match[1]}:${match[2]}` : match[1];
    }
    return new URL(url).host || "UNKNOWN";
  } catch {
    return "UNKNOWN";
  }
}

const connectionString = process.env.DATABASE_URL || process.env.DIRECT_URL;

const dbUrlHost = extractHost(process.env.DATABASE_URL);
const directUrlHost = extractHost(process.env.DIRECT_URL);
const resolvedHost = extractHost(connectionString);

console.log(
  `[PRISMA_INIT_DIAGNOSTIC] DATABASE_URL host: ${dbUrlHost} | DIRECT_URL host: ${directUrlHost} | pg.Pool target: ${resolvedHost}`
);

if (!connectionString) {
  throw new Error("DATABASE_URL or DIRECT_URL is not set");
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  prismaPool: Pool | undefined;
};

const pool =
  globalForPrisma.prismaPool ??
  new Pool({
    connectionString,
    ssl: {
      rejectUnauthorized: false,
    },
  });

const adapter = new PrismaPg(pool);

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
  globalForPrisma.prismaPool = pool;
}
