import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import {
  listQCDailyEntriesByEntryDate,
  listQCDailyEntriesByUserAndEntryDate,
} from "@/lib/repositories/qcRepo";

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

  try {
    const entries =
      auth.role === "ADMIN"
        ? await listQCDailyEntriesByEntryDate(entryDate)
        : await listQCDailyEntriesByUserAndEntryDate(Number(auth.employeeNumber), entryDate);

    return NextResponse.json({ entries }, { status: 200 });
  } catch (err) {
    console.error("qc-daily-production-list GET error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
