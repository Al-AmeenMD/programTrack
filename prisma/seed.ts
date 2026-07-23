import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

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

async function upsertProgram(data: {
  name: string;
  description: string;
  start_date: Date;
  end_date: Date;
  status: "active" | "upcoming";
}) {
  const existing = await prisma.program.findFirst({
    where: { name: data.name },
  });

  if (existing) {
    return prisma.program.update({
      where: { id: existing.id },
      data,
    });
  }

  return prisma.program.create({ data });
}

async function main() {
  const dataAnalysis = await upsertProgram({
    name: "Data Analysis Course",
    description: "Hands-on data analysis training for Development Hub participants.",
    start_date: new Date("2026-07-01"),
    end_date: new Date("2026-09-30"),
    status: "active",
  });

  const dataScience = await upsertProgram({
    name: "Data Science Cohort",
    description: "Upcoming data science cohort covering Python, ML, and projects.",
    start_date: new Date("2026-08-15"),
    end_date: new Date("2026-12-15"),
    status: "upcoming",
  });

  const participants = await Promise.all([
    prisma.participant.upsert({
      where: { email: "amina.yusuf@example.com" },
      update: {
        full_name: "Amina Yusuf",
        phone: "+2348010000001",
        gender: "female",
        date_of_birth: new Date("2001-04-12"),
        status: "active",
      },
      create: {
        full_name: "Amina Yusuf",
        email: "amina.yusuf@example.com",
        phone: "+2348010000001",
        gender: "female",
        date_of_birth: new Date("2001-04-12"),
      },
    }),
    prisma.participant.upsert({
      where: { email: "musa.bello@example.com" },
      update: {
        full_name: "Musa Bello",
        phone: "+2348010000002",
        gender: "male",
        date_of_birth: new Date("1999-11-03"),
        status: "active",
      },
      create: {
        full_name: "Musa Bello",
        email: "musa.bello@example.com",
        phone: "+2348010000002",
        gender: "male",
        date_of_birth: new Date("1999-11-03"),
      },
    }),
    prisma.participant.upsert({
      where: { email: "zainab.ali@example.com" },
      update: {
        full_name: "Zainab Ali",
        phone: "+2348010000003",
        gender: "female",
        status: "active",
      },
      create: {
        full_name: "Zainab Ali",
        email: "zainab.ali@example.com",
        phone: "+2348010000003",
        gender: "female",
      },
    }),
    prisma.participant.upsert({
      where: { phone: "+2348010000004" },
      update: {
        full_name: "Chinedu Okafor",
        email: null,
        gender: "male",
        status: "active",
      },
      create: {
        full_name: "Chinedu Okafor",
        email: null,
        phone: "+2348010000004",
        gender: "male",
      },
    }),
    prisma.participant.upsert({
      where: { phone: "+2348010000005" },
      update: {
        full_name: "Fatima Sani",
        email: null,
        gender: "female",
        status: "active",
      },
      create: {
        full_name: "Fatima Sani",
        email: null,
        phone: "+2348010000005",
        gender: "female",
      },
    }),
  ]);

  const enrollments = [
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
  for (const enrollment of enrollments) {
    const dbEnrollment = await prisma.enrollment.upsert({
      where: {
        participant_id_program_id: {
          participant_id: enrollment.participant_id,
          program_id: enrollment.program_id,
        },
      },
      update: {
        status: enrollment.status,
        metadata: enrollment.metadata,
      },
      create: enrollment,
    });
    seededEnrollments.push(dbEnrollment);
  }

  // --- Seed StaffUsers ---
  const adminUser = await prisma.staffUser.upsert({
    where: { email: "admin@developmenthub.org" },
    update: {
      full_name: "Admin User",
      password_hash: "mock-password-hash-admin",
      role: "admin",
    },
    create: {
      full_name: "Admin User",
      email: "admin@developmenthub.org",
      password_hash: "mock-password-hash-admin",
      role: "admin",
    },
  });

  const facilitatorUser = await prisma.staffUser.upsert({
    where: { email: "facilitator@developmenthub.org" },
    update: {
      full_name: "Facilitator User",
      password_hash: "mock-password-hash-facilitator",
      role: "facilitator",
    },
    create: {
      full_name: "Facilitator User",
      email: "facilitator@developmenthub.org",
      password_hash: "mock-password-hash-facilitator",
      role: "facilitator",
    },
  });

  // --- Seed ProgramStaff ---
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

  // --- Seed Sessions ---
  const session1 = await prisma.session.findFirst({
    where: { program_id: dataAnalysis.id, title: "Week 1: Introduction to SQL" }
  }) || await prisma.session.create({
    data: {
      program_id: dataAnalysis.id,
      title: "Week 1: Introduction to SQL",
      session_date: new Date("2026-07-02"),
    }
  });

  const session2 = await prisma.session.findFirst({
    where: { program_id: dataAnalysis.id, title: "Week 2: Advanced SQL Joins" }
  }) || await prisma.session.create({
    data: {
      program_id: dataAnalysis.id,
      title: "Week 2: Advanced SQL Joins",
      session_date: new Date("2026-07-09"),
    }
  });

  // --- Seed AttendanceRecords ---
  const daEnrollments = seededEnrollments.filter(e => e.program_id === dataAnalysis.id);

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

  // --- Seed FormTemplate ---
  await prisma.formTemplate.findFirst({
    where: { program_id: dataAnalysis.id, name: "Intake Questionnaire" }
  }) || await prisma.formTemplate.create({
    data: {
      program_id: dataAnalysis.id,
      name: "Intake Questionnaire",
      type: "intake",
      fields: [
        { label: "Prior Coding Experience", field_type: "select", required: true },
        { label: "Why do you want to join this program?", field_type: "textarea", required: true },
        { label: "How did you hear about us?", field_type: "text", required: false }
      ],
    }
  });
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
