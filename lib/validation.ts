import { z } from "zod";

const optionalText = z
  .preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().trim().min(1).optional().nullable()
  );

const optionalEmail = z
  .preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().trim().email().optional().nullable()
  );

const metadataSchema = z.record(z.string(), z.unknown()).default({});

export const participantCoreSchema = z
  .object({
    full_name: z.string().trim().min(1, "full_name is required"),
    email: optionalEmail,
    phone: optionalText,
    gender: optionalText,
    date_of_birth: optionalText,
    metadata: metadataSchema,
  })
  .refine((data) => Boolean(data.email || data.phone), {
    message: "At least one of email or phone is required",
    path: ["email"],
  });

export const createParticipantSchema = participantCoreSchema.extend({
  program_id: optionalText,
});

export const updateParticipantSchema = z
  .object({
    full_name: z.string().trim().min(1).optional(),
    email: optionalEmail,
    phone: optionalText,
    gender: optionalText,
    date_of_birth: optionalText,
    metadata: metadataSchema.optional(),
    status: z.enum(["active", "inactive"]).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "Provide at least one field to update",
  });

export const createProgramSchema = z.object({
  name: z.string().trim().min(1, "name is required"),
  description: optionalText,
  start_date: optionalText,
  end_date: optionalText,
  status: z.enum(["upcoming", "active", "completed", "cancelled"]).default("upcoming"),
  created_by: optionalText,
});

export const updateProgramSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    description: optionalText,
    start_date: optionalText,
    end_date: optionalText,
    status: z.enum(["upcoming", "active", "completed", "cancelled"]).optional(),
    created_by: optionalText,
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "Provide at least one field to update",
  });

export const updateEnrollmentSchema = z
  .object({
    status: z.enum(["registered", "active", "dropped", "completed"]).optional(),
    metadata: metadataSchema.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "Provide status or metadata to update",
  });
