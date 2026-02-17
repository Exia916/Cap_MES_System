import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import { db } from "@/lib/db";

type ListResponse = { entries: any[] } | { error: string };

function isValidShiftDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export async function GET(req: NextRequest) {
  const auth = await getAuthFromRequest(req as any);
  if (!auth) {
    return NextResponse.json<ListResponse>({ error: "Unauthorized" }, { status: 401 });
  }

  const shiftDate = req.nextUrl.searchParams.get("shiftDate")?.trim() ?? "";
  if (!isValidShiftDate(shiftDate)) {
    return NextResponse.json<ListResponse>(
      { error: "Missing or invalid shiftDate (expected YYYY-MM-DD)" },
      { status: 400 }
    );
  }

  try {
    const params: any[] = [shiftDate];
    let where = `e.shift_date = $1`;

    // non-admin -> own entries only
    if (auth.role !== "ADMIN") {
      params.push(Number(auth.employeeNumber));
      where += ` AND e.employee_number = $2`;
    }

    const { rows } = await db.query(
      `
      SELECT
        e.id,
        e.submission_id AS "submissionId",
        e.entry_ts AS "entryTs",
        e.name,
        e.employee_number AS "employeeNumber",
        e.shift,
        e.machine_number AS "machineNumber",
        e.sales_order AS "salesOrder",
        e.detail_number AS "detailNumber",
        e.embroidery_location AS "embroideryLocation",
        e.stitches,
        e.pieces,
        e.is_3d AS "is3d",
        e.is_knit AS "isKnit",
        e.detail_complete AS "detailComplete",
        e.notes
      FROM public.embroidery_daily_entries e
      WHERE ${where}
      ORDER BY e.entry_ts DESC
      `,
      params
    );

    return NextResponse.json<ListResponse>({ entries: rows }, { status: 200 });
  } catch (err) {
    console.error("daily-production-list GET error:", err);
    return NextResponse.json<ListResponse>({ error: "Server error" }, { status: 500 });
  }
}
