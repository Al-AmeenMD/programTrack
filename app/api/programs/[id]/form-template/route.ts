import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { ApiError, handleApiError } from "../../../../../lib/api";
import { getFacilitatorProgramIds, requireAuth, requireRole } from "../../../../../lib/auth";
import { prisma } from "../../../../../lib/prisma";
import { createFormTemplateSchema, updateFormTemplateSchema } from "../../../../../lib/validation";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuth(req);
    const { id: programId } = await context.params;

    if (user.role === "facilitator") {
      const assignedProgramIds = await getFacilitatorProgramIds(user.id);
      if (!assignedProgramIds.includes(programId)) {
        throw new ApiError("Forbidden: program not assigned to facilitator", 403);
      }
    }

    const template = await prisma.formTemplate.findFirst({
      where: {
        program_id: programId,
        type: "intake",
      },
    });

    return NextResponse.json({ data: template });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    await requireRole("admin", req);
    const { id: programId } = await context.params;

    const program = await prisma.program.findUnique({
      where: { id: programId },
      select: { id: true },
    });

    if (!program) {
      return NextResponse.json({ error: "Program not found" }, { status: 404 });
    }

    const existing = await prisma.formTemplate.findFirst({
      where: {
        program_id: programId,
        type: "intake",
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Program already has an intake form template. Use PATCH to update existing template." },
        { status: 409 }
      );
    }

    const body = createFormTemplateSchema.parse(await req.json());

    const template = await prisma.formTemplate.create({
      data: {
        program_id: programId,
        name: body.name,
        type: "intake",
        fields: body.fields as unknown as Prisma.InputJsonValue,
      },
    });

    return NextResponse.json({ data: template }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    await requireRole("admin", req);
    const { id: programId } = await context.params;

    const template = await prisma.formTemplate.findFirst({
      where: {
        program_id: programId,
        type: "intake",
      },
    });

    if (!template) {
      return NextResponse.json({ error: "Form template not found for this program" }, { status: 404 });
    }

    const body = updateFormTemplateSchema.parse(await req.json());

    const existingResponseCount = await prisma.formResponse.count({
      where: { form_template_id: template.id },
    });

    const updatedTemplate = await prisma.formTemplate.update({
      where: { id: template.id },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.fields !== undefined && {
          fields: body.fields as unknown as Prisma.InputJsonValue,
        }),
      },
    });

    const responsePayload: { data: typeof updatedTemplate; warning?: string } = {
      data: updatedTemplate,
    };

    if (existingResponseCount > 0) {
      responsePayload.warning = `${existingResponseCount} existing response(s) were submitted under the previous field definitions and may no longer match updated fields.`;
    }

    return NextResponse.json(responsePayload);
  } catch (error) {
    return handleApiError(error);
  }
}
