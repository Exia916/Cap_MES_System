import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyJwt } from "@/lib/auth";
import { query } from "@/lib/db";

type Line = {
  salesOrder: string | number;
  detailNumber?: string | number | null;
  emblemType?: string | null;
  logoName?: string | null;
  pieces: string | number;
  notes?: string | null;
};

type Body = {
  entryDate: string; // YYYY-MM-DD
  headerNotes?: string | null;
  lines: Line[];
};

export async function POST(req: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const payload = verifyJwt(token);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = (await req.json()) as Body;

    if (!body.entryDate) return NextResponse.json({ error: "entryDate required" }, { status: 400 });
    if (!Array.isArray(body.lines) || body.lines.length === 0) {
      return NextResponse.json({ error: "At least one line is required" }, { status: 400 });
    }

    const name = payload.displayName ?? payload.username ?? "Unknown";
    const employeeNumber =
      payload.employeeNumber !== undefined && payload.employeeNumber !== null && payload.employeeNumber !== ""
        ? Number(payload.employeeNumber)
        : null;

    // 1) create header
    const headerRes = await query<{ id: string }>(
      `
      INSERT INTO emblem_daily_submissions (entry_date, name, employee_number, notes)
      VALUES ($1::date, $2::text, $3::int, $4::text)
      RETURNING id
      `,
      [body.entryDate, name, employeeNumber, (body.headerNotes ?? "").trim() || null]
    );

    const submissionId = headerRes.rows[0]?.id;
    if (!submissionId) return NextResponse.json({ error: "Failed to create submission" }, { status: 500 });

    // 2) insert lines
    for (const line of body.lines) {
      const salesOrder = Number(line.salesOrder);
      const pieces = Number(line.pieces);

      if (!Number.isFinite(salesOrder)) {
        return NextResponse.json({ error: "Each line needs a valid salesOrder" }, { status: 400 });
      }
      if (!Number.isFinite(pieces)) {
        return NextResponse.json({ error: "Each line needs a valid pieces" }, { status: 400 });
      }

      const detailNumber =
        line.detailNumber === undefined || line.detailNumber === null || line.detailNumber === ""
          ? null
          : Number(line.detailNumber);

      await query(
        `
        INSERT INTO emblem_daily_submission_lines
          (submission_id, sales_order, detail_number, emblem_type, logo_name, pieces, line_notes)
        VALUES
          ($1::uuid, $2::bigint, $3::int, $4::text, $5::text, $6::int, $7::text)
        `,
        [
          submissionId,
          salesOrder,
          detailNumber,
          (line.emblemType ?? "").trim() || null,
          (line.logoName ?? "").trim() || null,
          pieces,
          (line.notes ?? "").trim() || null,
        ]
      );
    }

    return NextResponse.json({ ok: true, id: submissionId });
  } catch (err: any) {
    console.error("emblem-production-submission POST error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
