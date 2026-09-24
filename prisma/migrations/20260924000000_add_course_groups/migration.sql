-- CreateTable
CREATE TABLE IF NOT EXISTS "course_groups" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "course_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "course_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "facilitator_groups" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "program_staff_id" UUID NOT NULL,
    "course_group_id" UUID NOT NULL,

    CONSTRAINT "facilitator_groups_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "enrollments" ADD COLUMN IF NOT EXISTS "course_group_id" UUID;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "course_groups_course_id_name_key" ON "course_groups"("course_id", "name");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "course_groups_course_id_idx" ON "course_groups"("course_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "facilitator_groups_program_staff_id_course_group_id_key" ON "facilitator_groups"("program_staff_id", "course_group_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "enrollments_course_group_id_idx" ON "enrollments"("course_group_id");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'course_groups_course_id_fkey'
  ) THEN
    ALTER TABLE "course_groups" ADD CONSTRAINT "course_groups_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'facilitator_groups_program_staff_id_fkey'
  ) THEN
    ALTER TABLE "facilitator_groups" ADD CONSTRAINT "facilitator_groups_program_staff_id_fkey" FOREIGN KEY ("program_staff_id") REFERENCES "program_staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'facilitator_groups_course_group_id_fkey'
  ) THEN
    ALTER TABLE "facilitator_groups" ADD CONSTRAINT "facilitator_groups_course_group_id_fkey" FOREIGN KEY ("course_group_id") REFERENCES "course_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'enrollments_course_group_id_fkey'
  ) THEN
    ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_course_group_id_fkey" FOREIGN KEY ("course_group_id") REFERENCES "course_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
