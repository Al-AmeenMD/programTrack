# ProgramTrack — Internal Operations & Program Management System

ProgramTrack is a Next.js 16 + Prisma + PostgreSQL web application for managing tech training cohorts, participant enrollments, session attendance marking, intake forms, and staff roles (Admin vs. Facilitator).

---

## 🔒 Database Architecture: Dev & Production Separation

> [!IMPORTANT]
> **STRICT ENVIRONMENT SEPARATION RULE**:
> Local development and live production MUST use completely separate databases.
> - **Local Development**: Points to a dedicated **Development Supabase Project** configured in your local `.env` file.
> - **Production**: Deployed via Vercel with environment variables pointing to the **Production Supabase Database**.
> - **NEVER** point your local `.env` connection strings at the live production database!

---

## 🛡️ Environment Safety Guards

All seed, clean, and database utility scripts (`prisma/seed.ts`, `scripts/clean-production.ts`, etc.) include an automated **Environment Guard** check.

When executing any script that modifies database contents, the script will output the target host at the very start of execution:

```text
======================================================================
[ENVIRONMENT GUARD] Connecting to Database Host: db.xxxxxx.supabase.co
======================================================================
```

**Always verify the printed host** in your terminal before letting script operations proceed.

---

## 🚀 Setting Up a Fresh Local Development Database

Follow these steps to configure and initialize a new local development database:

### 1. Create a Dev Supabase Project
1. Log in to [Supabase](https://supabase.com) and create a new project (e.g. `programtrack-dev`).
2. Obtain your **Pooled Connection String** (Port 6543) and **Direct Connection String** (Port 5432).

### 2. Configure Local `.env`
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Update `.env` with your dev project connection strings:
```env
DATABASE_URL="postgresql://postgres.[DEV_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres:[PASSWORD]@db.[DEV_REF].supabase.co:5432/postgres"
JWT_SECRET="programtrack-dev-secret-key"
```

### 3. Push Database Schema
Apply the Prisma schema to your dev database:
```bash
npx prisma db push
```

### 4. Seed Initial Data
Seed initial administrative accounts and sample data:
```bash
npx prisma db seed
```

### 5. Start Development Server
```bash
npm run dev
```

---

## 🛠️ Key Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Starts local Next.js development server at `http://localhost:3000` |
| `npm run build` | Generates Prisma client and builds production Next.js bundle |
| `npm run db:seed` | Runs idempotent database seed script (`prisma/seed.ts`) |
| `npm run db:clean` | Wipes test records and leaves only the primary Admin account |
| `npx tsc --noEmit` | Runs full TypeScript static type checking |
