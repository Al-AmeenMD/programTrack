import Papa from "papaparse";
import { ApiError, parseDate } from "./api";
import { createOrEnrollParticipant } from "./participants/createOrEnrollParticipant";
import { prisma } from "./prisma";

export type RawCsvRow = {
  first_name?: string;
  middle_name?: string;
  last_name?: string;
  nin_number?: string;
  qualification?: string;
  full_name?: string;
  email?: string;
  phone?: string;
  gender?: string;
  date_of_birth?: string;
  course_name?: string;
  course_id?: string;
};

export type PreviewRowAction = "new_participant" | "new_enrollment" | "skip";

export type PreviewRowResult = {
  row_number: number;
  full_name: string;
  first_name?: string;
  last_name?: string;
  nin_number?: string;
  email: string | null;
  phone: string | null;
  gender: string | null;
  date_of_birth: string | null;
  course_name: string | null;
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
  skipped_details: Array<{ row_number: number; full_name: string; reason: string }>;
  results: CommitRowResult[];
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseCsvString(csvContent: string): RawCsvRow[] {
  const parsed = Papa.parse<Record<string, string>>(csvContent, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase().replace(/\s+/g, "_"),
  });

  return (parsed.data || []).map((row) => {
    let firstName = row.first_name?.trim() || "";
    let middleName = row.middle_name?.trim() || "";
    let lastName = row.last_name?.trim() || row.surname?.trim() || "";
    let ninNumber = row.nin_number?.trim() || row.nin?.trim() || "";
    const qualification = row.qualification?.trim() || "";

    // Legacy fallback if single full_name column is provided
    if (!firstName && !lastName && row.full_name?.trim()) {
      const parts = row.full_name.trim().split(/\s+/).filter(Boolean);
      if (parts.length === 1) {
        firstName = parts[0];
        lastName = "N/A";
      } else if (parts.length === 2) {
        firstName = parts[0];
        lastName = parts[1];
      } else if (parts.length >= 3) {
        firstName = parts[0];
        lastName = parts[parts.length - 1];
        middleName = parts.slice(1, parts.length - 1).join(" ");
      }
    }

    if (!ninNumber) {
      ninNumber = "NIN-PENDING";
    }

    const computedFullName = [firstName, middleName, lastName].filter(Boolean).join(" ");

    return {
      first_name: firstName,
      middle_name: middleName,
      last_name: lastName,
      nin_number: ninNumber,
      qualification,
      full_name: computedFullName,
      email: row.email?.trim() || "",
      phone: row.phone?.trim() || "",
      gender: row.gender?.trim() || "",
      date_of_birth: row.date_of_birth?.trim() || row["dob"]?.trim() || "",
      course_name: row.course_name?.trim() || row["course"]?.trim() || row["track"]?.trim() || "",
      course_id: row.course_id?.trim() || "",
    };
  });
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

  const programCourses = await prisma.course.findMany({
    where: { program_id: programId },
  });
  const courseMapByName = new Map(programCourses.map((c) => [c.name.trim().toLowerCase(), c]));
  const courseMapById = new Map(programCourses.map((c) => [c.id, c]));

  const previewRows: PreviewRowResult[] = [];
  let newParticipantCount = 0;
  let newEnrollmentCount = 0;
  let skippedCount = 0;

  const seenInFileEmails = new Set<string>();
  const seenInFilePhones = new Set<string>();
  const inFileEnrolledParticipantIds = new Set<string>();

  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i];
    const rowNumber = i + 1;
    const firstName = raw.first_name?.trim() || "";
    const middleName = raw.middle_name?.trim() || null;
    const lastName = raw.last_name?.trim() || "";
    const ninNumber = raw.nin_number?.trim() || "";
    const fullName = raw.full_name?.trim() || [firstName, middleName, lastName].filter(Boolean).join(" ");
    const email = raw.email?.trim() || null;
    const phone = raw.phone?.trim() || null;
    const gender = raw.gender?.trim() || null;
    const dobString = raw.date_of_birth?.trim() || null;
    const rawCourseName = raw.course_name?.trim() || null;
    const rawCourseId = raw.course_id?.trim() || null;

    let targetCourseId: string | null = null;
    let matchedCourseName: string | null = null;

    if (!firstName || !lastName) {
      skippedCount++;
      previewRows.push({
        row_number: rowNumber,
        full_name: fullName,
        first_name: firstName,
        last_name: lastName,
        nin_number: ninNumber,
        email,
        phone,
        gender,
        date_of_birth: dobString,
        course_name: null,
        action: "skip",
        skip_reason: "Missing first_name or last_name",
      });
      continue;
    }

    if (!ninNumber) {
      skippedCount++;
      previewRows.push({
        row_number: rowNumber,
        full_name: fullName,
        first_name: firstName,
        last_name: lastName,
        nin_number: ninNumber,
        email,
        phone,
        gender,
        date_of_birth: dobString,
        course_name: null,
        action: "skip",
        skip_reason: "Missing nin_number",
      });
      continue;
    }

    if (!email && !phone) {
      skippedCount++;
      previewRows.push({
        row_number: rowNumber,
        full_name: fullName,
        first_name: firstName,
        last_name: lastName,
        nin_number: ninNumber,
        email,
        phone,
        gender,
        date_of_birth: dobString,
        course_name: null,
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
        first_name: firstName,
        last_name: lastName,
        nin_number: ninNumber,
        email,
        phone,
        gender,
        date_of_birth: dobString,
        course_name: null,
        action: "skip",
        skip_reason: "Invalid email format",
      });
      continue;
    }

    // Match course if specified
    if (rawCourseId) {
      const match = courseMapById.get(rawCourseId);
      if (!match) {
        skippedCount++;
        previewRows.push({
          row_number: rowNumber,
          full_name: fullName,
          first_name: firstName,
          last_name: lastName,
          nin_number: ninNumber,
          email,
          phone,
          gender,
          date_of_birth: dobString,
          course_name: null,
          action: "skip",
          skip_reason: `Course ID '${rawCourseId}' does not exist for this program`,
        });
        continue;
      }
      targetCourseId = match.id;
      matchedCourseName = match.name;
    } else if (rawCourseName) {
      const match = courseMapByName.get(rawCourseName.toLowerCase());
      if (!match) {
        skippedCount++;
        previewRows.push({
          row_number: rowNumber,
          full_name: fullName,
          first_name: firstName,
          last_name: lastName,
          nin_number: ninNumber,
          email,
          phone,
          gender,
          date_of_birth: dobString,
          course_name: rawCourseName,
          action: "skip",
          skip_reason: `Course '${rawCourseName}' does not exist for this program`,
        });
        continue;
      }
      targetCourseId = match.id;
      matchedCourseName = match.name;
    }

    // Check duplicate in same CSV file
    if (email && seenInFileEmails.has(email)) {
      skippedCount++;
      previewRows.push({
        row_number: rowNumber,
        full_name: fullName,
        first_name: firstName,
        last_name: lastName,
        nin_number: ninNumber,
        email,
        phone,
        gender,
        date_of_birth: dobString,
        course_name: matchedCourseName,
        action: "skip",
        skip_reason: "Duplicate email within the uploaded file",
      });
      continue;
    }

    if (phone && seenInFilePhones.has(phone)) {
      skippedCount++;
      previewRows.push({
        row_number: rowNumber,
        full_name: fullName,
        first_name: firstName,
        last_name: lastName,
        nin_number: ninNumber,
        email,
        phone,
        gender,
        date_of_birth: dobString,
        course_name: matchedCourseName,
        action: "skip",
        skip_reason: "Duplicate phone within the uploaded file",
      });
      continue;
    }

    // Query database to determine action
    const matchConditions = [
      email ? { email } : null,
      phone ? { phone } : null,
    ].filter(Boolean) as Array<{ email: string } | { phone: string }>;

    const dbMatches = await prisma.participant.findMany({
      where: { OR: matchConditions },
      take: 2,
    });

    if (dbMatches.length > 1) {
      skippedCount++;
      previewRows.push({
        row_number: rowNumber,
        full_name: fullName,
        first_name: firstName,
        last_name: lastName,
        nin_number: ninNumber,
        email,
        phone,
        gender,
        date_of_birth: dobString,
        course_name: matchedCourseName,
        action: "skip",
        skip_reason: "Email and phone match different existing participants in database",
      });
      continue;
    }

    const existingParticipant = dbMatches[0] ?? null;

    if (!existingParticipant) {
      newParticipantCount++;
      if (email) seenInFileEmails.add(email);
      if (phone) seenInFilePhones.add(phone);
      previewRows.push({
        row_number: rowNumber,
        full_name: fullName,
        first_name: firstName,
        last_name: lastName,
        nin_number: ninNumber,
        email,
        phone,
        gender,
        date_of_birth: dobString,
        course_name: matchedCourseName,
        action: "new_participant",
        skip_reason: null,
      });
      continue;
    }

    // Existing participant match
    if (inFileEnrolledParticipantIds.has(existingParticipant.id)) {
      skippedCount++;
      previewRows.push({
        row_number: rowNumber,
        full_name: fullName,
        first_name: firstName,
        last_name: lastName,
        nin_number: ninNumber,
        email,
        phone,
        gender,
        date_of_birth: dobString,
        course_name: matchedCourseName,
        action: "skip",
        skip_reason: "Participant is enrolled multiple times in this uploaded file",
      });
      continue;
    }

    const existingEnrollment = await prisma.enrollment.findUnique({
      where: {
        participant_id_program_id: {
          participant_id: existingParticipant.id,
          program_id: programId,
        },
      },
    });

    if (existingEnrollment) {
      skippedCount++;
      previewRows.push({
        row_number: rowNumber,
        full_name: fullName,
        first_name: firstName,
        last_name: lastName,
        nin_number: ninNumber,
        email,
        phone,
        gender,
        date_of_birth: dobString,
        course_name: matchedCourseName,
        action: "skip",
        skip_reason: "Already enrolled in this program",
      });
      continue;
    }

    // Existing participant, new enrollment
    newEnrollmentCount++;
    if (email) seenInFileEmails.add(email);
    if (phone) seenInFilePhones.add(phone);
    inFileEnrolledParticipantIds.add(existingParticipant.id);
    previewRows.push({
      row_number: rowNumber,
      full_name: fullName,
      first_name: firstName,
      last_name: lastName,
      nin_number: ninNumber,
      email,
      phone,
      gender,
      date_of_birth: dobString,
      course_name: matchedCourseName,
      action: "new_enrollment",
      skip_reason: null,
    });
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

  const programCourses = await prisma.course.findMany({
    where: { program_id: programId },
  });
  const courseMapByName = new Map(programCourses.map((c) => [c.name.trim().toLowerCase(), c]));
  const courseMapById = new Map(programCourses.map((c) => [c.id, c]));

  let createdCount = 0;
  let enrolledCount = 0;
  let skippedCount = 0;
  const skippedDetails: Array<{ row_number: number; full_name: string; reason: string }> = [];
  const results: CommitRowResult[] = [];

  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i];
    const rowNumber = i + 1;
    const firstName = raw.first_name?.trim() || "";
    const middleName = raw.middle_name?.trim() || null;
    const lastName = raw.last_name?.trim() || "";
    const ninNumber = raw.nin_number?.trim() || "";
    const qualification = raw.qualification?.trim() || null;
    const fullName = raw.full_name?.trim() || [firstName, middleName, lastName].filter(Boolean).join(" ");
    const email = raw.email?.trim() || null;
    const phone = raw.phone?.trim() || null;
    const gender = raw.gender?.trim() || null;
    const dobString = raw.date_of_birth?.trim() || null;
    const rawCourseName = raw.course_name?.trim() || null;
    const rawCourseId = raw.course_id?.trim() || null;

    let targetCourseId: string | null = null;

    if (!firstName || !lastName) {
      skippedCount++;
      const reason = "Missing first_name or last_name";
      skippedDetails.push({ row_number: rowNumber, full_name: fullName, reason });
      results.push({ row_number: rowNumber, full_name: fullName, status: "skipped", reason });
      continue;
    }

    if (!ninNumber) {
      skippedCount++;
      const reason = "Missing nin_number";
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

    // Match course if specified
    if (rawCourseId) {
      const match = courseMapById.get(rawCourseId);
      if (!match) {
        skippedCount++;
        const reason = `Course ID '${rawCourseId}' does not exist for this program`;
        skippedDetails.push({ row_number: rowNumber, full_name: fullName, reason });
        results.push({ row_number: rowNumber, full_name: fullName, status: "skipped", reason });
        continue;
      }
      targetCourseId = match.id;
    } else if (rawCourseName) {
      const match = courseMapByName.get(rawCourseName.toLowerCase());
      if (!match) {
        skippedCount++;
        const reason = `Course '${rawCourseName}' does not exist for this program`;
        skippedDetails.push({ row_number: rowNumber, full_name: fullName, reason });
        results.push({ row_number: rowNumber, full_name: fullName, status: "skipped", reason });
        continue;
      }
      targetCourseId = match.id;
    }

    try {
      const outcome = await createOrEnrollParticipant(
        {
          first_name: firstName,
          middle_name: middleName,
          last_name: lastName,
          nin_number: ninNumber,
          qualification,
          email,
          phone,
          gender,
          date_of_birth: dobString,
        },
        programId,
        targetCourseId
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
