import { NextRequest, NextResponse } from "next/server";
import { ApiError, handleApiError } from "../../../../../../lib/api";
import { requireRole } from "../../../../../../lib/auth";
import { prisma } from "../../../../../../lib/prisma";
import { updateCourseGroupSchema } from "../../../../../../lib/validation";

type RouteContext = {
  params: Promise<{
    id: string;
    groupId: string;
  }>;
};

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    await requireRole("admin", req);
    const { id: courseId, groupId } = await context.params;

    const group = await prisma.courseGroup.findUnique({
      where: { id: groupId },
    });

    if (!group || group.course_id !== courseId) {
      return NextResponse.json({ error: "Group not found in this course" }, { status: 404 });
    }

    const body = updateCourseGroupSchema.parse(await req.json());
    const trimmedName = body.name.trim();

    // Check duplicate name within course
    const existing = await prisma.courseGroup.findFirst({
      where: {
        course_id: courseId,
        id: { not: groupId },
        name: {
          equals: trimmedName,
          mode: "insensitive",
        },
      },
    });

    if (existing) {
      throw new ApiError(`A group named '${trimmedName}' already exists in this course`, 409);
    }

    const updated = await prisma.courseGroup.update({
      where: { id: groupId },
      data: { name: trimmedName },
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    await requireRole("admin", req);
    const { id: courseId, groupId } = await context.params;

    const group = await prisma.courseGroup.findUnique({
      where: { id: groupId },
    });

    if (!group || group.course_id !== courseId) {
      return NextResponse.json({ error: "Group not found in this course" }, { status: 404 });
    }

    // Unassign enrollments from this group (soft removal)
    await prisma.enrollment.updateMany({
      where: { course_group_id: groupId },
      data: { course_group_id: null },
    });

    // Delete group (cascades facilitator_groups via DB relation)
    await prisma.courseGroup.delete({
      where: { id: groupId },
    });

    return NextResponse.json({
      data: { message: "Course group removed successfully" },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
