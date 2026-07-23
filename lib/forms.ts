import { ApiError, parseDate } from "./api";

export type FormField = {
  id?: string;
  label: string;
  field_type: "text" | "number" | "select" | "date" | "checkbox";
  required: boolean;
  options?: string[];
};

export function validateFormAnswers(
  fields: FormField[],
  answers: Record<string, unknown>
): Record<string, unknown> {
  const validatedAnswers: Record<string, unknown> = {};

  for (const field of fields) {
    const rawVal = answers[field.label] !== undefined ? answers[field.label] : answers[field.id || ""];

    const isMissing =
      rawVal === undefined || rawVal === null || (typeof rawVal === "string" && rawVal.trim() === "");

    if (field.required && isMissing) {
      throw new ApiError(`Field '${field.label}' is required`, 400);
    }

    if (isMissing) {
      continue;
    }

    switch (field.field_type) {
      case "text": {
        if (typeof rawVal !== "string") {
          throw new ApiError(`Field '${field.label}' must be a text string`, 400);
        }
        validatedAnswers[field.label] = rawVal.trim();
        break;
      }
      case "number": {
        const num = Number(rawVal);
        if (Number.isNaN(num)) {
          throw new ApiError(`Field '${field.label}' must be a valid number`, 400);
        }
        validatedAnswers[field.label] = num;
        break;
      }
      case "select": {
        if (typeof rawVal !== "string") {
          throw new ApiError(`Field '${field.label}' must be a string selection`, 400);
        }
        const trimmedVal = rawVal.trim();
        if (field.options && field.options.length > 0) {
          if (!field.options.includes(trimmedVal)) {
            throw new ApiError(
              `Field '${field.label}' value '${trimmedVal}' is not one of allowed options: ${field.options.join(", ")}`,
              400
            );
          }
        }
        validatedAnswers[field.label] = trimmedVal;
        break;
      }
      case "date": {
        try {
          const date = parseDate(rawVal as string | Date);
          validatedAnswers[field.label] = date ? date.toISOString().split("T")[0] : null;
        } catch {
          throw new ApiError(`Field '${field.label}' must be a valid date`, 400);
        }
        break;
      }
      case "checkbox": {
        if (typeof rawVal === "boolean") {
          validatedAnswers[field.label] = rawVal;
        } else if (rawVal === "true" || rawVal === "false") {
          validatedAnswers[field.label] = rawVal === "true";
        } else {
          throw new ApiError(`Field '${field.label}' must be a boolean checkbox value`, 400);
        }
        break;
      }
      default: {
        validatedAnswers[field.label] = rawVal;
      }
    }
  }

  return validatedAnswers;
}
