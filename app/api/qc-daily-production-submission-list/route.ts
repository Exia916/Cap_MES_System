import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import { listQCSubmissionSummariesByEntryDate } from "@/lib/repositories/qcRepo";

function isValidDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export async function GET(req: NextRequest) {
  const auth = await getAuthFromRequest(req as any);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const entryDate = req.nextUrl.searchParams.get("entryDate")?.trim() ?? "";
  if (!isValidDate(entryDate)) {
    return NextResponse.json({ error: "Missing or invalid entryDate (expected YYYY-MM-DD)" }, { status: 400 });
  }

  const summaries =
    auth.role === "ADMIN"
      ? await listQCSubmissionSummariesByEntryDate({ entryDate })
      : await listQCSubmissionSummariesByEntryDate({ entryDate, employeeNumber: Number(auth.employeeNumber) });

  return NextResponse.json({ submissions: summaries }, { status: 200 });
}
