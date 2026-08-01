import { Prisma } from "@prisma/client";
import { ApiError, parseDate } from "../api";
import { prisma } from "../prisma";

export type CreateOrEnrollParticipantInput = {
  first_name: string;
  middle_name?: string | null;
  last_name: string;
  nin_number: string;
  qualification?: string | null;
  email?: string | null;
  phone?: string | null;
  gender?: string | null;
  date_of_birth?: string | Date | null;
  metadata?: Prisma.InputJsonValue;
};

export async function createOrEnrollParticipant(
  input: CreateOrEnrollParticipantInput,
  programId?: string,
  courseId?: string | null
) {
  const email = input.email?.trim() || null;
  const phone = input.phone?.trim() || null;

  if (!email && !phone) {
    throw new ApiError("At least one of email or phone is required", 400);
  }

  const matchConditions = [
    email ? { email } : null,
    phone ? { phone } : null,
  ].filter(Boolean) as Array<{ email: string } | { phone: string }>;

  const matchingParticipants = await prisma.participant.findMany({
    where: { OR: matchConditions },
    take: 2,
  });

  if (matchingParticipants.length > 1) {
    throw new ApiError(
      "Email and phone match different existing participants",
      409
    );
  }

  const existingParticipant = matchingParticipants[0] ?? null;

  const firstName = input.first_name.trim();
  const middleName = input.middle_name?.trim() || null;
  const lastName = input.last_name.trim();
  const fullName = [firstName, middleName, lastName].filter(Boolean).join(" ");
  const ninNumber = input.nin_number?.trim() || "NIN-PENDING";
  const qualification = input.qualification?.trim() || null;

  const participant =
    existingParticipant ??
    (await prisma.participant.create({
      data: {
        first_name: firstName,
        middle_name: middleName,
        last_name: lastName,
        nin_number: ninNumber,
        qualification,
        full_name: fullName,
        email,
        phone,
        gender: input.gender?.trim() || null,
        date_of_birth: parseDate(input.date_of_birth),
        metadata: input.metadata ?? {},
      },
    }));

  if (!programId) {
    return {
      participant,
      enrollment: null,
      wasNewParticipant: !existingParticipant,
      wasNewEnrollment: false,
      has_intake_form: false,
      form_template_id: null,
    };
  }

  const program = await prisma.program.findUnique({
    where: { id: programId },
    select: { id: true },
  });

  if (!program) {
    throw new ApiError("Program not found", 404);
  }

  // If courseId is provided, validate it belongs to this program
  if (courseId) {
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true, program_id: true },
    });

    if (!course || course.program_id !== programId) {
      throw new ApiError("Course does not belong to this program", 400);
    }
  }

  const intakeTemplate = await prisma.formTemplate.findFirst({
    where: {
      program_id: programId,
      type: "intake",
    },
    select: { id: true },
  });

  const hasIntakeForm = Boolean(intakeTemplate);
  const formTemplateId = intakeTemplate?.id ?? null;

  const existingEnrollment = await prisma.enrollment.findUnique({
    where: {
      participant_id_program_id: {
        participant_id: participant.id,
        program_id: programId,
      },
    },
  });

  if (existingEnrollment) {
    return {
      participant,
      enrollment: existingEnrollment,
      wasNewParticipant: !existingParticipant,
      wasNewEnrollment: false,
      has_intake_form: hasIntakeForm,
      form_template_id: formTemplateId,
    };
  }

  const enrollment = await prisma.enrollment.create({
    data: {
      participant_id: participant.id,
      program_id: programId,
      course_id: courseId || null,
      status: "registered",
    },
  });

  return {
    participant,
    enrollment,
    wasNewParticipant: !existingParticipant,
    wasNewEnrollment: true,
    has_intake_form: hasIntakeForm,
    form_template_id: formTemplateId,
  };
}
