import { NextRequest, NextResponse } from "next/server";
import { ApiError, handleApiError } from "../../../../../../lib/api";
import { getFacilitatorProgramIds, requireAuth } from "../../../../../../lib/auth";
import { commitBulkUpload, parseCsvString, RawCsvRow } from "../../../../../../lib/bulkUpload";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuth(req);
    const { id: programId } = await context.params;

    if (user.role === "facilitator") {
      const assignedProgramIds = await getFacilitatorProgramIds(user.id);
      if (!assignedProgramIds.includes(programId)) {
        throw new ApiError("Forbidden: program not assigned to facilitator", 403);
      }
    }

    let rows: RawCsvRow[] = [];
    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file");
      if (!file) {
        throw new ApiError("No file uploaded in form data", 400);
      }
      const csvContent = typeof file === "string" ? file : await file.text();
      rows = parseCsvString(csvContent);
    } else if (contentType.includes("application/json")) {
      const body = await req.json();
      if (Array.isArray(body.rows)) {
        rows = body.rows as RawCsvRow[];
      } else if (typeof body.csv_content === "string") {
        rows = parseCsvString(body.csv_content);
      }
    } else {
      const csvContent = await req.text();
      rows = parseCsvString(csvContent);
    }

    if (!rows.length) {
      throw new ApiError("No rows found to commit", 400);
    }

    const commitSummary = await commitBulkUpload(programId, rows);

    return NextResponse.json({ data: commitSummary });
  } catch (error) {
    return handleApiError(error);
  }
}
