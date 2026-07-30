import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import bcrypt from "bcryptjs";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false,
  },
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// Fixed, deterministic UUIDs for seed entities to guarantee 100% idempotency
const SEED_ADMIN_ID = "13052baf-bb0b-4fdd-bf38-ec98e1fa2739";
const SEED_FACILITATOR_ID = "76f02055-7da7-4d3c-96d6-bb5b7fce5716";

const SEED_PROGRAM_DA_ID = "1ee1ffa8-bf04-4f39-8e3e-7e267e0fcd15";
const SEED_PROGRAM_DS_ID = "5cb62d0c-1b66-4ab8-a0e1-c52d17416237";

const SEED_PARTICIPANT_1_ID = "5a1b2659-3f5b-4417-8874-60019db39d8a"; // Amina Yusuf
const SEED_PARTICIPANT_2_ID = "5f719fac-a8d8-4a92-a118-fc5720a5e824"; // Musa Bello
const SEED_PARTICIPANT_3_ID = "98b7f7ee-ae19-42d2-bdae-d1283207cc3b"; // Zainab Ali
const SEED_PARTICIPANT_4_ID = "7eae8c42-ae06-433a-a312-dd00c1a3bad4"; // Chinedu Okafor
const SEED_PARTICIPANT_5_ID = "a45b63e1-7d3c-4c10-b805-d539fc5a24f9"; // Fatima Sani

const SEED_SESSION_1_ID = "00000000-0000-4000-d000-000000000001"; // Week 1: Introduction to SQL
const SEED_SESSION_2_ID = "00000000-0000-4000-d000-000000000002"; // Week 2: Advanced SQL Joins

const SEED_FORM_TEMPLATE_1_ID = "00000000-0000-4000-e000-000000000001"; // Intake Questionnaire

async function main() {
  // 1. Seed Programs (Upsert by fixed ID)
  const dataAnalysis = await prisma.program.upsert({
    where: { id: SEED_PROGRAM_DA_ID },
    update: {
      name: "Data Analysis Course",
      description: "Hands-on data analysis training for ProgramTrack participants.",
      start_date: new Date("2026-07-01"),
      end_date: new Date("2026-09-30"),
      status: "active",
    },
    create: {
      id: SEED_PROGRAM_DA_ID,
      name: "Data Analysis Course",
      description: "Hands-on data analysis training for ProgramTrack participants.",
      start_date: new Date("2026-07-01"),
      end_date: new Date("2026-09-30"),
      status: "active",
    },
  });

  const dataScience = await prisma.program.upsert({
    where: { id: SEED_PROGRAM_DS_ID },
    update: {
      name: "Data Science Cohort",
      description: "Upcoming data science cohort covering Python, ML, and projects.",
      start_date: new Date("2026-08-15"),
      end_date: new Date("2026-12-15"),
      status: "upcoming",
    },
    create: {
      id: SEED_PROGRAM_DS_ID,
      name: "Data Science Cohort",
      description: "Upcoming data science cohort covering Python, ML, and projects.",
      start_date: new Date("2026-08-15"),
      end_date: new Date("2026-12-15"),
      status: "upcoming",
    },
  });

  // 2. Seed Participants (Upsert by fixed ID)
  const participants = await Promise.all([
    prisma.participant.upsert({
      where: { id: SEED_PARTICIPANT_1_ID },
      update: {
        first_name: "Amina",
        last_name: "Yusuf",
        nin_number: "10000000001",
        full_name: "Amina Yusuf",
        email: "amina.yusuf@example.com",
        phone: "+2348010000001",
        gender: "female",
        date_of_birth: new Date("2001-04-12"),
        status: "active",
      },
      create: {
        id: SEED_PARTICIPANT_1_ID,
        first_name: "Amina",
        last_name: "Yusuf",
        nin_number: "10000000001",
        full_name: "Amina Yusuf",
        email: "amina.yusuf@example.com",
        phone: "+2348010000001",
        gender: "female",
        date_of_birth: new Date("2001-04-12"),
      },
    }),
    prisma.participant.upsert({
      where: { id: SEED_PARTICIPANT_2_ID },
      update: {
        first_name: "Musa",
        last_name: "Bello",
        nin_number: "10000000002",
        full_name: "Musa Bello",
        email: "musa.bello@example.com",
        phone: "+2348010000002",
        gender: "male",
        date_of_birth: new Date("1999-11-03"),
        status: "active",
      },
      create: {
        id: SEED_PARTICIPANT_2_ID,
        first_name: "Musa",
        last_name: "Bello",
        nin_number: "10000000002",
        full_name: "Musa Bello",
        email: "musa.bello@example.com",
        phone: "+2348010000002",
        gender: "male",
        date_of_birth: new Date("1999-11-03"),
      },
    }),
    prisma.participant.upsert({
      where: { id: SEED_PARTICIPANT_3_ID },
      update: {
        first_name: "Zainab",
        last_name: "Ali",
        nin_number: "10000000003",
        full_name: "Zainab Ali",
        email: "zainab.ali@example.com",
        phone: "+2348010000003",
        gender: "female",
        status: "active",
      },
      create: {
        id: SEED_PARTICIPANT_3_ID,
        first_name: "Zainab",
        last_name: "Ali",
        nin_number: "10000000003",
        full_name: "Zainab Ali",
        email: "zainab.ali@example.com",
        phone: "+2348010000003",
        gender: "female",
      },
    }),
    prisma.participant.upsert({
      where: { id: SEED_PARTICIPANT_4_ID },
      update: {
        first_name: "Chinedu",
        last_name: "Okafor",
        nin_number: "10000000004",
        full_name: "Chinedu Okafor",
        phone: "+2348010000004",
        gender: "male",
        status: "active",
      },
      create: {
        id: SEED_PARTICIPANT_4_ID,
        first_name: "Chinedu",
        last_name: "Okafor",
        nin_number: "10000000004",
        full_name: "Chinedu Okafor",
        phone: "+2348010000004",
        gender: "male",
      },
    }),
    prisma.participant.upsert({
      where: { id: SEED_PARTICIPANT_5_ID },
      update: {
        first_name: "Fatima",
        last_name: "Sani",
        nin_number: "10000000005",
        full_name: "Fatima Sani",
        phone: "+2348010000005",
        gender: "female",
        status: "active",
      },
      create: {
        id: SEED_PARTICIPANT_5_ID,
        first_name: "Fatima",
        last_name: "Sani",
        nin_number: "10000000005",
        full_name: "Fatima Sani",
        phone: "+2348010000005",
        gender: "female",
      },
    }),
  ]);

  // 3. Seed Enrollments (Upsert by compound key participant_id_program_id)
  const enrollmentsData = [
    {
      participant_id: participants[0].id,
      program_id: dataAnalysis.id,
      status: "active" as const,
      metadata: { cohort: "DA-2026-A" },
    },
    {
      participant_id: participants[1].id,
      program_id: dataAnalysis.id,
      status: "active" as const,
      metadata: { cohort: "DA-2026-A" },
    },
    {
      participant_id: participants[2].id,
      program_id: dataScience.id,
      status: "registered" as const,
      metadata: { cohort: "DS-2026-A" },
    },
    {
      participant_id: participants[3].id,
      program_id: dataScience.id,
      status: "registered" as const,
      metadata: { cohort: "DS-2026-A" },
    },
    {
      participant_id: participants[0].id,
      program_id: dataScience.id,
      status: "registered" as const,
      metadata: { cohort: "DS-2026-A", note: "Also enrolled in Data Analysis" },
    },
  ];

  const seededEnrollments = [];
  for (const en of enrollmentsData) {
    const dbEnrollment = await prisma.enrollment.upsert({
      where: {
        participant_id_program_id: {
          participant_id: en.participant_id,
          program_id: en.program_id,
        },
      },
      update: {
        status: en.status,
        metadata: en.metadata,
      },
      create: en,
    });
    seededEnrollments.push(dbEnrollment);
  }

  // 4. Seed StaffUsers (Upsert by fixed ID)
  const adminPasswordHash = bcrypt.hashSync("admin123", 10);
  const facilitatorPasswordHash = bcrypt.hashSync("facilitator123", 10);

  const adminUser = await prisma.staffUser.upsert({
    where: { id: SEED_ADMIN_ID },
    update: {
      full_name: "Admin User",
      email: "admin@developmenthub.ng",
      password_hash: adminPasswordHash,
      role: "admin",
    },
    create: {
      id: SEED_ADMIN_ID,
      full_name: "Admin User",
      email: "admin@developmenthub.ng",
      password_hash: adminPasswordHash,
      role: "admin",
    },
  });

  const facilitatorUser = await prisma.staffUser.upsert({
    where: { id: SEED_FACILITATOR_ID },
    update: {
      full_name: "Facilitator User",
      email: "facilitator@developmenthub.ng",
      password_hash: facilitatorPasswordHash,
      role: "facilitator",
    },
    create: {
      id: SEED_FACILITATOR_ID,
      full_name: "Facilitator User",
      email: "facilitator@developmenthub.ng",
      password_hash: facilitatorPasswordHash,
      role: "facilitator",
    },
  });

  // 5. Seed ProgramStaff (Upsert by compound key staff_user_id_program_id)
  await prisma.programStaff.upsert({
    where: {
      staff_user_id_program_id: {
        staff_user_id: facilitatorUser.id,
        program_id: dataAnalysis.id,
      },
    },
    update: {},
    create: {
      staff_user_id: facilitatorUser.id,
      program_id: dataAnalysis.id,
    },
  });

  // 6. Seed Sessions (Upsert by fixed ID)
  const session1 = await prisma.session.upsert({
    where: { id: SEED_SESSION_1_ID },
    update: {
      program_id: dataAnalysis.id,
      title: "Week 1: Introduction to SQL",
      session_date: new Date("2026-07-02"),
    },
    create: {
      id: SEED_SESSION_1_ID,
      program_id: dataAnalysis.id,
      title: "Week 1: Introduction to SQL",
      session_date: new Date("2026-07-02"),
    },
  });

  const session2 = await prisma.session.upsert({
    where: { id: SEED_SESSION_2_ID },
    update: {
      program_id: dataAnalysis.id,
      title: "Week 2: Advanced SQL Joins",
      session_date: new Date("2026-07-09"),
    },
    create: {
      id: SEED_SESSION_2_ID,
      program_id: dataAnalysis.id,
      title: "Week 2: Advanced SQL Joins",
      session_date: new Date("2026-07-09"),
    },
  });

  // 7. Seed AttendanceRecords (Upsert by compound key session_id_enrollment_id)
  const daEnrollments = seededEnrollments.filter((e) => e.program_id === dataAnalysis.id);

  if (daEnrollments.length >= 2) {
    const enrollmentAmina = daEnrollments[0];
    const enrollmentMusa = daEnrollments[1];

    await prisma.attendanceRecord.upsert({
      where: {
        session_id_enrollment_id: {
          session_id: session1.id,
          enrollment_id: enrollmentAmina.id,
        },
      },
      update: {
        status: "present",
        marked_by: facilitatorUser.id,
      },
      create: {
        session_id: session1.id,
        enrollment_id: enrollmentAmina.id,
        status: "present",
        marked_by: facilitatorUser.id,
      },
    });

    await prisma.attendanceRecord.upsert({
      where: {
        session_id_enrollment_id: {
          session_id: session1.id,
          enrollment_id: enrollmentMusa.id,
        },
      },
      update: {
        status: "late",
        marked_by: facilitatorUser.id,
      },
      create: {
        session_id: session1.id,
        enrollment_id: enrollmentMusa.id,
        status: "late",
        marked_by: facilitatorUser.id,
      },
    });

    await prisma.attendanceRecord.upsert({
      where: {
        session_id_enrollment_id: {
          session_id: session2.id,
          enrollment_id: enrollmentAmina.id,
        },
      },
      update: {
        status: "present",
        marked_by: facilitatorUser.id,
      },
      create: {
        session_id: session2.id,
        enrollment_id: enrollmentAmina.id,
        status: "present",
        marked_by: facilitatorUser.id,
      },
    });

    await prisma.attendanceRecord.upsert({
      where: {
        session_id_enrollment_id: {
          session_id: session2.id,
          enrollment_id: enrollmentMusa.id,
        },
      },
      update: {
        status: "absent",
        marked_by: facilitatorUser.id,
      },
      create: {
        session_id: session2.id,
        enrollment_id: enrollmentMusa.id,
        status: "absent",
        marked_by: facilitatorUser.id,
      },
    });
  }

  // 8. Seed FormTemplate (Upsert by fixed ID)
  await prisma.formTemplate.upsert({
    where: { id: SEED_FORM_TEMPLATE_1_ID },
    update: {
      program_id: dataAnalysis.id,
      name: "Intake Questionnaire",
      type: "intake",
      fields: [
        { label: "Prior Coding Experience", field_type: "select", required: true },
        { label: "Why do you want to join this program?", field_type: "textarea", required: true },
        { label: "How did you hear about us?", field_type: "text", required: false },
      ],
    },
    create: {
      id: SEED_FORM_TEMPLATE_1_ID,
      program_id: dataAnalysis.id,
      name: "Intake Questionnaire",
      type: "intake",
      fields: [
        { label: "Prior Coding Experience", field_type: "select", required: true },
        { label: "Why do you want to join this program?", field_type: "textarea", required: true },
        { label: "How did you hear about us?", field_type: "text", required: false },
      ],
    },
  });

  console.log("Database seeded successfully and deterministically.");
}

main()
  .then(async () => {
    await prisma.$disconnect();
    await pool.end();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    await pool.end();
    process.exit(1);
  });
