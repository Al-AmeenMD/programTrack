import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { ApiError, handleApiError } from "../../../../../lib/api";
import { getFacilitatorProgramIds, requireAuth } from "../../../../../lib/auth";
import { FormField, validateFormAnswers } from "../../../../../lib/forms";
import { prisma } from "../../../../../lib/prisma";
import { submitFormResponseSchema } from "../../../../../lib/validation";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuth(req);
    const { id: enrollmentId } = await context.params;

    const enrollment = await prisma.enrollment.findUnique({
      where: { id: enrollmentId },
      select: { id: true, program_id: true },
    });

    if (!enrollment) {
      return NextResponse.json({ error: "Enrollment not found" }, { status: 404 });
    }

    if (user.role === "facilitator") {
      const assignedProgramIds = await getFacilitatorProgramIds(user.id);
      if (!assignedProgramIds.includes(enrollment.program_id)) {
        throw new ApiError("Forbidden: enrollment not in your assigned programs", 403);
      }
    }

    const formResponse = await prisma.formResponse.findFirst({
      where: { enrollment_id: enrollmentId },
      include: {
        form_template: true,
      },
    });

    return NextResponse.json({ data: formResponse });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuth(req);
    const { id: enrollmentId } = await context.params;

    const enrollment = await prisma.enrollment.findUnique({
      where: { id: enrollmentId },
      select: { id: true, program_id: true },
    });

    if (!enrollment) {
      return NextResponse.json({ error: "Enrollment not found" }, { status: 404 });
    }

    if (user.role === "facilitator") {
      const assignedProgramIds = await getFacilitatorProgramIds(user.id);
      if (!assignedProgramIds.includes(enrollment.program_id)) {
        throw new ApiError("Forbidden: enrollment not in your assigned programs", 403);
      }
    }

    const template = await prisma.formTemplate.findFirst({
      where: {
        program_id: enrollment.program_id,
        type: "intake",
      },
    });

    if (!template) {
      return NextResponse.json({ error: "No intake form template exists for this program" }, { status: 404 });
    }

    const body = submitFormResponseSchema.parse(await req.json());

    const fields = (template.fields as unknown as FormField[]) || [];
    const validatedAnswers = validateFormAnswers(fields, body.answers);

    const existingResponse = await prisma.formResponse.findFirst({
      where: {
        form_template_id: template.id,
        enrollment_id: enrollmentId,
      },
    });

    const formResponse = existingResponse
      ? await prisma.formResponse.update({
          where: { id: existingResponse.id },
          data: {
            answers: validatedAnswers as Prisma.InputJsonValue,
            submitted_at: new Date(),
          },
          include: { form_template: true },
        })
      : await prisma.formResponse.create({
          data: {
            form_template_id: template.id,
            enrollment_id: enrollmentId,
            answers: validatedAnswers as Prisma.InputJsonValue,
          },
          include: { form_template: true },
        });

    return NextResponse.json({ data: formResponse }, { status: existingResponse ? 200 : 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
