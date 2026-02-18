import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyJwt } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(req: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const payload = verifyJwt(token);
    if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const entryDate = searchParams.get("entryDate"); // optional YYYY-MM-DD
    const mine = searchParams.get("mine") === "true"; // optional
    const salesOrderParam = searchParams.get("salesOrder"); // optional

    const where: string[] = [];
    const params: any[] = [];

    if (entryDate) {
      params.push(entryDate);
      where.push(`s.entry_date = $${params.length}::date`);
    }

    if (salesOrderParam) {
      const so = Number(salesOrderParam);
      if (Number.isFinite(so)) {
        params.push(so);
        where.push(`s.sales_order = $${params.length}::bigint`);
      }
    }

    if (mine) {
      // Prefer employee_number if available; fallback to name
      if (payload.employeeNumber) {
        params.push(Number(payload.employeeNumber));
        where.push(`s.employee_number = $${params.length}::int`);
      } else {
        params.push(payload.displayName ?? payload.username ?? "");
        where.push(`s.name = $${params.length}::text`);
      }
    }

    const sql = `
      SELECT
        s.id,

        -- ✅ Central Time display for list
        to_char(
          s.entry_ts AT TIME ZONE 'America/Chicago',
          'YYYY-MM-DD HH24:MI:SS'
        ) as entry_ts_display,

        s.sales_order::text as sales_order,
        s.name,
        s.employee_number,
        s.notes,

        COUNT(l.id)::int as line_count,
        COALESCE(SUM(l.pieces), 0)::int as total_pieces

      FROM emblem_daily_submissions s
      LEFT JOIN emblem_daily_submission_lines l
        ON l.submission_id = s.id

      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}

      GROUP BY s.id
      ORDER BY s.entry_ts DESC
      LIMIT 500
    `;

    const { rows } = await db.query(sql, params);
    return NextResponse.json({ rows });
  } catch (err: any) {
    console.error("emblem-production-submission-list GET error:", err);
    return NextResponse.json({ error: err?.message || "Server error" }, { status: 500 });
  }
}
