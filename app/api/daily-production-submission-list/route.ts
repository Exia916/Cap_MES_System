import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import { db } from "@/lib/db";

type Resp = { submissions: any[] } | { error: string };

function isValidShiftDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/**
 * Returns 1 row per submission for a given shiftDate.
 * Uses line.shift_date (generated) to ensure it matches your existing reporting logic.
 */
export async function GET(req: NextRequest) {
  const auth = await getAuthFromRequest(req as any);
  if (!auth) return NextResponse.json<Resp>({ error: "Unauthorized" }, { status: 401 });

  const shiftDate = req.nextUrl.searchParams.get("shiftDate")?.trim() ?? "";
  if (!isValidShiftDate(shiftDate)) {
    return NextResponse.json<Resp>(
      { error: "Missing or invalid shiftDate (expected YYYY-MM-DD)" },
      { status: 400 }
    );
  }

  try {
    const params: any[] = [shiftDate];
    let where = `e.shift_date = $1 AND e.submission_id IS NOT NULL`;

    if (auth.role !== "ADMIN") {
      params.push(Number(auth.employeeNumber));
      where += ` AND s.employee_number = $2`;
    }

    const { rows } = await db.query(
      `
      SELECT
        s.id,
        s.entry_ts AS "entryTs",
        s.name,
        s.employee_number AS "employeeNumber",
        s.shift,
        s.machine_number AS "machineNumber",
        s.sales_order AS "salesOrder",
        s.notes,
        s.created_at AS "createdAt",
        COUNT(e.id)::int AS "lineCount",
        SUM(COALESCE(e.stitches,0))::int AS "totalStitches",
        SUM(COALESCE(e.pieces,0))::int AS "totalPieces"
      FROM public.embroidery_daily_submissions s
      JOIN public.embroidery_daily_entries e
        ON e.submission_id = s.id
      WHERE ${where}
      GROUP BY s.id
      ORDER BY s.entry_ts DESC
      `,
      params
    );

    return NextResponse.json<Resp>({ submissions: rows }, { status: 200 });
  } catch (err) {
    console.error("daily-production-submission-list GET error:", err);
    return NextResponse.json<Resp>({ error: "Server error" }, { status: 500 });
  }
}
