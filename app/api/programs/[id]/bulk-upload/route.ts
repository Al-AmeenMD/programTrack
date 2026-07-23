import { NextRequest, NextResponse } from "next/server";
import { ApiError, handleApiError } from "../../../../../lib/api";
import { getFacilitatorProgramIds, requireAuth } from "../../../../../lib/auth";
import { parseCsvString, previewBulkUpload, RawCsvRow } from "../../../../../lib/bulkUpload";

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

    let csvContent = "";
    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file");
      if (!file) {
        throw new ApiError("No file uploaded in form data", 400);
      }
      if (typeof file === "string") {
        csvContent = file;
      } else {
        csvContent = await file.text();
      }
    } else if (contentType.includes("application/json")) {
      const body = await req.json();
      if (Array.isArray(body.rows)) {
        const previewSummary = await previewBulkUpload(programId, body.rows as RawCsvRow[]);
        return NextResponse.json({ data: previewSummary });
      }
      csvContent = body.csv_content || "";
    } else {
      csvContent = await req.text();
    }

    if (!csvContent.trim()) {
      throw new ApiError("CSV content is empty", 400);
    }

    const rows = parseCsvString(csvContent);
    const previewSummary = await previewBulkUpload(programId, rows);

    return NextResponse.json({ data: previewSummary });
  } catch (error) {
    return handleApiError(error);
  }
}
