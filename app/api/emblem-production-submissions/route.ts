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
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

    const headerRes = await db.query(
      `
      SELECT id, entry_ts, entry_date, sales_order::text as sales_order, name, employee_number, notes
      FROM emblem_daily_submissions
      WHERE id = $1::uuid
      LIMIT 1
      `,
      [id]
    );

    const header = headerRes.rows[0];
    if (!header) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const linesRes = await db.query(
      `
      SELECT
        id,
        detail_number,
        emblem_type,
        logo_name,
        pieces,
        line_notes
      FROM emblem_daily_submission_lines
      WHERE submission_id = $1::uuid
      ORDER BY created_at ASC
      `,
      [id]
    );

    return NextResponse.json({ header, lines: linesRes.rows });
  } catch (err: any) {
    console.error("emblem-production-submissions GET error:", err);
    return NextResponse.json({ error: err?.message || "Server error" }, { status: 500 });
  }
}
