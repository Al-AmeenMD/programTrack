import Papa from "papaparse";
import { ApiError, parseDate } from "./api";
import { createOrEnrollParticipant } from "./participants/createOrEnrollParticipant";
import { prisma } from "./prisma";

export type RawCsvRow = {
  full_name?: string;
  email?: string;
  phone?: string;
  gender?: string;
  date_of_birth?: string;
};

export type PreviewRowAction = "new_participant" | "new_enrollment" | "skip";

export type PreviewRowResult = {
  row_number: number;
  full_name: string;
  email: string | null;
  phone: string | null;
  gender: string | null;
  date_of_birth: string | null;
  action: PreviewRowAction;
  skip_reason: string | null;
};

export type PreviewSummary = {
  total: number;
  new_participant_count: number;
  new_enrollment_count: number;
  skipped_count: number;
  rows: PreviewRowResult[];
};

export type CommitRowResult = {
  row_number: number;
  full_name: string;
  status: "created" | "enrolled" | "skipped";
  reason?: string;
  participant_id?: string;
  enrollment_id?: string;
};

export type CommitResultSummary = {
  total: number;
  created_count: number;
  enrolled_count: number;
  skipped_count: number;
  skipped_details: Array<{
    row_number: number;
    full_name: string;
    reason: string;
  }>;
  results: CommitRowResult[];
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseCsvString(csvContent: string): RawCsvRow[] {
  const parsed = Papa.parse<Record<string, string>>(csvContent, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase().replace(/\s+/g, "_"),
  });

  return (parsed.data || []).map((row) => ({
    full_name: row.full_name?.trim() || row["name"]?.trim() || "",
    email: row.email?.trim() || "",
    phone: row.phone?.trim() || "",
    gender: row.gender?.trim() || "",
    date_of_birth: row.date_of_birth?.trim() || row["dob"]?.trim() || "",
  }));
}

export async function previewBulkUpload(
  programId: string,
  rows: RawCsvRow[]
): Promise<PreviewSummary> {
  const program = await prisma.program.findUnique({
    where: { id: programId },
    select: { id: true },
  });

  if (!program) {
    throw new ApiError("Program not found", 404);
  }

  const previewRows: PreviewRowResult[] = [];
  let newParticipantCount = 0;
  let newEnrollmentCount = 0;
  let skippedCount = 0;

  // Track in-file processed emails and phones to handle duplicates within the CSV file
  const seenInFileEmails = new Set<string>();
  const seenInFilePhones = new Set<string>();
  const inFileEnrolledParticipantIds = new Set<string>();

  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i];
    const rowNumber = i + 1;
    const fullName = raw.full_name?.trim() || "";
    const email = raw.email?.trim() || null;
    const phone = raw.phone?.trim() || null;
    const gender = raw.gender?.trim() || null;
    const dobString = raw.date_of_birth?.trim() || null;

    if (!fullName) {
      skippedCount++;
      previewRows.push({
        row_number: rowNumber,
        full_name: fullName,
        email,
        phone,
        gender,
        date_of_birth: dobString,
        action: "skip",
        skip_reason: "Missing full_name",
      });
      continue;
    }

    if (!email && !phone) {
      skippedCount++;
      previewRows.push({
        row_number: rowNumber,
        full_name: fullName,
        email,
        phone,
        gender,
        date_of_birth: dobString,
        action: "skip",
        skip_reason: "At least one of email or phone is required",
      });
      continue;
    }

    if (email && !EMAIL_REGEX.test(email)) {
      skippedCount++;
      previewRows.push({
        row_number: rowNumber,
        full_name: fullName,
        email,
        phone,
        gender,
        date_of_birth: dobString,
        action: "skip",
        skip_reason: "Invalid email format",
      });
      continue;
    }

    if (dobString) {
      try {
        parseDate(dobString);
      } catch {
        skippedCount++;
        previewRows.push({
          row_number: rowNumber,
          full_name: fullName,
          email,
          phone,
          gender,
          date_of_birth: dobString,
          action: "skip",
          skip_reason: "Invalid date of birth format",
        });
        continue;
      }
    }

    // Check DB for matching participant
    const matchConditions = [
      email ? { email } : null,
      phone ? { phone } : null,
    ].filter(Boolean) as Array<{ email: string } | { phone: string }>;

    const existingParticipants = await prisma.participant.findMany({
      where: { OR: matchConditions },
      take: 2,
    });

    if (existingParticipants.length > 1) {
      skippedCount++;
      previewRows.push({
        row_number: rowNumber,
        full_name: fullName,
        email,
        phone,
        gender,
        date_of_birth: dobString,
        action: "skip",
        skip_reason: "Email and phone match different existing participants",
      });
      continue;
    }

    const dbParticipant = existingParticipants[0] ?? null;

    let isExistingInFile = false;
    if (!dbParticipant) {
      if ((email && seenInFileEmails.has(email)) || (phone && seenInFilePhones.has(phone))) {
        isExistingInFile = true;
      }
    }

    if (dbParticipant) {
      const existingEnrollment = await prisma.enrollment.findUnique({
        where: {
          participant_id_program_id: {
            participant_id: dbParticipant.id,
            program_id: programId,
          },
        },
      });

      if (existingEnrollment || inFileEnrolledParticipantIds.has(dbParticipant.id)) {
        skippedCount++;
        previewRows.push({
          row_number: rowNumber,
          full_name: fullName,
          email,
          phone,
          gender,
          date_of_birth: dobString,
          action: "skip",
          skip_reason: "Already enrolled in this program",
        });
        continue;
      }

      newEnrollmentCount++;
      inFileEnrolledParticipantIds.add(dbParticipant.id);
      previewRows.push({
        row_number: rowNumber,
        full_name: fullName,
        email,
        phone,
        gender,
        date_of_birth: dobString,
        action: "new_enrollment",
        skip_reason: null,
      });
    } else if (isExistingInFile) {
      // Participant was created by a previous row in this same file
      skippedCount++;
      previewRows.push({
        row_number: rowNumber,
        full_name: fullName,
        email,
        phone,
        gender,
        date_of_birth: dobString,
        action: "skip",
        skip_reason: "Already enrolled in this program",
      });
    } else {
      newParticipantCount++;
      if (email) seenInFileEmails.add(email);
      if (phone) seenInFilePhones.add(phone);

      previewRows.push({
        row_number: rowNumber,
        full_name: fullName,
        email,
        phone,
        gender,
        date_of_birth: dobString,
        action: "new_participant",
        skip_reason: null,
      });
    }
  }

  return {
    total: rows.length,
    new_participant_count: newParticipantCount,
    new_enrollment_count: newEnrollmentCount,
    skipped_count: skippedCount,
    rows: previewRows,
  };
}

export async function commitBulkUpload(
  programId: string,
  rows: RawCsvRow[]
): Promise<CommitResultSummary> {
  const program = await prisma.program.findUnique({
    where: { id: programId },
    select: { id: true },
  });

  if (!program) {
    throw new ApiError("Program not found", 404);
  }

  let createdCount = 0;
  let enrolledCount = 0;
  let skippedCount = 0;
  const skippedDetails: Array<{ row_number: number; full_name: string; reason: string }> = [];
  const results: CommitRowResult[] = [];

  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i];
    const rowNumber = i + 1;
    const fullName = raw.full_name?.trim() || "";
    const email = raw.email?.trim() || null;
    const phone = raw.phone?.trim() || null;
    const gender = raw.gender?.trim() || null;
    const dobString = raw.date_of_birth?.trim() || null;

    if (!fullName) {
      skippedCount++;
      const reason = "Missing full_name";
      skippedDetails.push({ row_number: rowNumber, full_name: fullName, reason });
      results.push({ row_number: rowNumber, full_name: fullName, status: "skipped", reason });
      continue;
    }

    if (!email && !phone) {
      skippedCount++;
      const reason = "At least one of email or phone is required";
      skippedDetails.push({ row_number: rowNumber, full_name: fullName, reason });
      results.push({ row_number: rowNumber, full_name: fullName, status: "skipped", reason });
      continue;
    }

    if (email && !EMAIL_REGEX.test(email)) {
      skippedCount++;
      const reason = "Invalid email format";
      skippedDetails.push({ row_number: rowNumber, full_name: fullName, reason });
      results.push({ row_number: rowNumber, full_name: fullName, status: "skipped", reason });
      continue;
    }

    try {
      const outcome = await createOrEnrollParticipant(
        {
          full_name: fullName,
          email,
          phone,
          gender,
          date_of_birth: dobString,
        },
        programId
      );

      if (outcome.wasNewParticipant) {
        createdCount++;
        results.push({
          row_number: rowNumber,
          full_name: fullName,
          status: "created",
          participant_id: outcome.participant.id,
          enrollment_id: outcome.enrollment?.id,
        });
      } else if (outcome.wasNewEnrollment) {
        enrolledCount++;
        results.push({
          row_number: rowNumber,
          full_name: fullName,
          status: "enrolled",
          participant_id: outcome.participant.id,
          enrollment_id: outcome.enrollment?.id,
        });
      } else {
        skippedCount++;
        const reason = "Already enrolled in this program";
        skippedDetails.push({ row_number: rowNumber, full_name: fullName, reason });
        results.push({
          row_number: rowNumber,
          full_name: fullName,
          status: "skipped",
          reason,
          participant_id: outcome.participant.id,
          enrollment_id: outcome.enrollment?.id,
        });
      }
    } catch (err: unknown) {
      skippedCount++;
      const reason = (err as { message?: string }).message || "Import failed";
      skippedDetails.push({ row_number: rowNumber, full_name: fullName, reason });
      results.push({ row_number: rowNumber, full_name: fullName, status: "skipped", reason });
    }
  }

  return {
    total: rows.length,
    created_count: createdCount,
    enrolled_count: enrolledCount,
    skipped_count: skippedCount,
    skipped_details: skippedDetails,
    results,
  };
}
