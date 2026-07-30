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
    first_name: z.string().trim().min(1, "First name is required"),
    middle_name: optionalText,
    last_name: z.string().trim().min(1, "Last / surname is required"),
    nin_number: z
      .string()
      .trim()
      .min(1, "NIN number is required")
      .regex(/^\d{11}$/, "NIN number must be exactly 11 numeric digits"),
    qualification: optionalText,
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
  course_id: optionalText,
});

export const updateParticipantSchema = z
  .object({
    first_name: z.string().trim().min(1).optional(),
    middle_name: optionalText,
    last_name: z.string().trim().min(1).optional(),
    nin_number: z
      .string()
      .trim()
      .regex(/^\d{11}$/, "NIN number must be exactly 11 numeric digits")
      .optional(),
    qualification: optionalText,
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
    course_id: optionalText,
    metadata: metadataSchema.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "Provide status, course_id, or metadata to update",
  });

export const loginSchema = z.object({
  email: z.string().trim().email("Valid email is required"),
  password: z.string().min(1, "Password is required"),
});

export const createStaffSchema = z.object({
  full_name: z.string().trim().min(1, "full_name is required"),
  email: z.string().trim().email("Valid email is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(["admin", "facilitator"]),
});

export const updateStaffSchema = z
  .object({
    full_name: z.string().trim().min(1).optional(),
    role: z.enum(["admin", "facilitator"]).optional(),
    status: z.enum(["active", "inactive"]).optional(),
    password: z.string().min(6).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "Provide at least one field to update",
  });

export const assignStaffProgramSchema = z.object({
  program_id: z.string().uuid("Valid program_id UUID is required"),
});

export const assignStaffCourseSchema = z.object({
  program_id: z.string().uuid("Valid program_id UUID is required"),
  course_id: z.string().uuid("Valid course_id UUID is required"),
});

export const changePasswordSchema = z.object({
  current_password: z.string().min(1, "Current password is required"),
  new_password: z.string().min(6, "New password must be at least 6 characters"),
});

export const formFieldSchema = z.object({
  id: z.string().optional(),
  label: z.string().trim().min(1, "Field label is required"),
  field_type: z.enum(["text", "number", "select", "date", "checkbox"]),
  required: z.boolean().default(false),
  options: z.array(z.string().trim().min(1)).optional(),
});

export const createFormTemplateSchema = z.object({
  name: z.string().trim().min(1, "Form name is required"),
  fields: z.array(formFieldSchema).min(1, "At least one field is required"),
});

export const updateFormTemplateSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    fields: z.array(formFieldSchema).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "Provide name or fields to update",
  });

export const submitFormResponseSchema = z.object({
  answers: z.record(z.string(), z.unknown()),
});

export const createSessionSchema = z.object({
  title: z.string().trim().min(1, "Session title is required"),
  session_date: z.string().trim().min(1, "Session date is required"),
});

export const updateSessionSchema = z
  .object({
    title: z.string().trim().min(1).optional(),
    session_date: z.string().trim().min(1).optional(),
    is_active: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "Provide at least one field to update",
  });

export const markAttendanceItemSchema = z.object({
  enrollment_id: z.string().uuid("Valid enrollment_id UUID is required"),
  status: z.enum(["present", "absent", "late", "excused"]),
});

export const markAttendanceSchema = z.object({
  records: z.array(markAttendanceItemSchema).min(1, "At least one attendance record is required"),
});

export const updateAttendanceRecordSchema = z.object({
  status: z.enum(["present", "absent", "late", "excused"]),
});

export const markAllPresentSchema = z.object({
  except: z
    .array(
      z.union([
        z.string().uuid(),
        z.object({
          enrollment_id: z.string().uuid(),
          status: z.enum(["present", "absent", "late", "excused"]).optional(),
        }),
      ])
    )
    .optional()
    .default([]),
});
