# ProgramTrack — Project Context

## What this is
An internal participant/program management system for ProgramTrack. ProgramTrack runs multiple programs concurrently (e.g. Data Analysis course, Data Science course, STEM programs). Staff need to:
- Manage a directory of participants (people)
- Manage programs (courses/cohorts running at ProgramTrack)
- Enroll participants into programs, track their status per program
- Add participants manually one at a time, or bulk upload via CSV
- Edit, deactivate (soft delete), and search/filter participants and enrollments

This is a single-tenant internal tool, not a multi-tenant SaaS. No need for org/tenant abstraction.

## Stack
- Next.js (App Router) + TypeScript
- Prisma 7 with driver adapter pattern
- PostgreSQL via Supabase
- Auth: simple staff login (single role, no complex permission tiers needed for v1)
- UI: Tailwind CSS + shadcn/ui components
- CSV parsing: papaparse (client-side preview) or server-side parse on upload

## Data model (source of truth — do not redesign without checking in)

**participants** — global directory of people, not tied to a single program
- id (uuid, pk)
- full_name
- email (nullable, but unique if present)
- phone (nullable, but unique if present)
- gender (nullable)
- date_of_birth (nullable)
- metadata (jsonb) — flexible field for anything not in the core schema
- status (enum: active / inactive) — soft delete flag
- created_at, updated_at

**programs**
- id (uuid, pk)
- name
- description (nullable)
- start_date, end_date (nullable)
- status (enum: upcoming / active / completed)
- created_by (staff user id, nullable for v1)
- created_at, updated_at

**enrollments** — join table, participant <-> program
- id (uuid, pk)
- participant_id (fk -> participants.id)
- program_id (fk -> programs.id)
- status (enum: registered / active / dropped / completed)
- metadata (jsonb) — program-specific fields (cohort, batch, intake answers, etc.)
- enrolled_at (timestamp)
- created_at, updated_at
- **unique constraint on (participant_id, program_id)** — a participant can only have one enrollment record per program

## Non-negotiables
1. **Shared creation logic.** Manual "Add Participant" form and bulk CSV upload must both call the same `createOrEnrollParticipant()` function. Match existing participants by email or phone before creating a new participant record. Never let bulk upload be a separate/looser code path than manual entry.
2. **Soft deletes only.** Never hard-delete participants or enrollments. Use status fields.
3. **Enrollments are program-scoped.** A participant's core record (name, email, phone) is shared across all their program enrollments. Editing core info from within one program's view should be done carefully — flag this if the UI doesn't make that clear to staff.
4. **Bulk upload must be safe.** Always show a preview step before committing rows. Always return a results summary after commit (X created, Y matched to existing participant, Z skipped with reasons). Never silently fail rows.
5. **Unique constraint enforcement.** (participant_id, program_id) must be enforced at the DB level, not just in application logic.

## Expanded scope (added after initial build started)
The program manager wants feature parity with a reference product (Aplikant) in specific areas: dashboards/reporting for leadership, attendance tracking, custom intake/feedback forms, certificates, and multi-staff logins with permissions. This is a real scope increase, not cosmetic. Treat auth/roles as foundational since it affects every other feature.

**Timeline constraint:** program starts within 2 weeks. Not everything is needed on day one:
- Needed by launch: roles/auth, participants/programs/enrollments CRUD, bulk upload, custom intake forms, attendance
- Needed later in the program's run, not day one: dashboards/reporting (more useful once real data exists), feedback forms, certificates (only needed at program completion)

### Additional data models

**StaffUser**
- id, full_name, email, password_hash, role (enum: admin / facilitator), created_at
- admin: full access to all programs, participants, staff management
- facilitator: scoped to programs they're assigned to; can mark attendance, view/add participants, cannot manage staff or delete programs

**ProgramStaff** (join table, which facilitators are assigned to which programs)
- id, staff_user_id, program_id

**Session** (a single day/meeting of a program, for attendance)
- id, program_id, title, session_date, created_at

**AttendanceRecord**
- id, session_id, enrollment_id, status (enum: present / absent / late / excused), marked_at, marked_by (staff_user_id)
- unique constraint on (session_id, enrollment_id)

**FormTemplate** (custom intake forms, program-specific — used for intake only; feedback is handled via Google Forms, see note below)
- id, program_id, name, type (enum: intake), fields (jsonb — array of field definitions: label, type, required), created_at

**FormResponse**
- id, form_template_id, enrollment_id, answers (jsonb), submitted_at

**Feedback (not a custom-built feature):** feedback collection uses Google Forms, one per program, linked from the program page in-app. Not part of the Prisma schema. If dashboard integration is useful later, pull responses via Sheets API rather than building a custom form/response system.

**Certificate**
- id, enrollment_id, issued_at, certificate_url (generated PDF stored in Supabase storage or similar), template_used
- Only generated when enrollment.status = "completed"

## Out of scope for v1
- Multi-tenancy / multiple organizations
- Payment or fee tracking
- Email/SMS notifications (can be added later)
- Complex approval workflows beyond admin/facilitator roles

## Verification standard (non-negotiable, added after a trust failure in Phase 7)
On Phase 7, "manual QA verified" claims (header rendering, enrollment action buttons, bulk upload button) were reported as PASS in the walkthrough without ever actually opening the app in a browser. This was confirmed directly: the QA checklist was written based on what the code was expected to do, not on anything observed. This is not acceptable and must not happen again.

From this point forward, in every phase:
- "Manually verified" or "PASS" for anything UI-related means the running app was actually opened in a browser and the specific element was observed rendering and functioning correctly. Not "the code that should produce this was written."
- If something was NOT actually observed running, say so explicitly rather than reporting PASS. A true "I did not verify this" is always acceptable. A false "PASS" is not, under any circumstance.
- For backend/API work, the same standard applies to verification scripts: a script passing means it was actually executed and its output observed, not assumed from the code.
- If time pressure makes full verification difficult, say that directly and let the developer (Al-Amin) decide whether to accept partial verification, rather than silently reporting full verification that didn't happen.

## Build approach
This is being built by Antigravity (AI agent) in phases, with the developer (Al-Amin) reviewing, testing, and running migrations manually between phases. Each phase should be reviewed before moving to the next. Do not let the agent combine phases or skip ahead. Given the expanded scope and 2-week timeline, phases are sequenced by launch necessity, not by convenience, see roadmap.