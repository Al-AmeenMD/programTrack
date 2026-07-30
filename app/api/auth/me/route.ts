import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "../../../../lib/api";
import { getFacilitatorProgramIds, requireAuth } from "../../../../lib/auth";

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    const assignedProgramIds =
      user.role === "facilitator"
        ? await getFacilitatorProgramIds(user.id)
        : [];

    return NextResponse.json({
      data: {
        ...user,
        assignedProgramIds,
      },
    });
  } catch (error) {
    const res = handleApiError(error);
    res.cookies.delete("programtrack_session");
    return res;
  }
}
