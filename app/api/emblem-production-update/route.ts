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
  id: string;
  entryDate: string;
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

    if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });
    if (!body.entryDate) return NextResponse.json({ error: "entryDate required" }, { status: 400 });
    if (!Array.isArray(body.lines) || body.lines.length === 0) {
      return NextResponse.json({ error: "At least one line is required" }, { status: 400 });
    }

    // Update header
    await query(
      `
      UPDATE emblem_daily_submissions
      SET entry_date = $2::date,
          notes = $3::text,
          updated_at = now()
      WHERE id = $1::uuid
      `,
      [body.id, body.entryDate, (body.headerNotes ?? "").trim() || null]
    );

    // Replace lines (simple + safe)
    await query(`DELETE FROM emblem_daily_submission_lines WHERE submission_id = $1::uuid`, [body.id]);

    for (const line of body.lines) {
      const salesOrder = Number(line.salesOrder);
      const pieces = Number(line.pieces);
      if (!Number.isFinite(salesOrder) || !Number.isFinite(pieces)) {
        return NextResponse.json({ error: "Invalid line data" }, { status: 400 });
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
          body.id,
          salesOrder,
          detailNumber,
          (line.emblemType ?? "").trim() || null,
          (line.logoName ?? "").trim() || null,
          pieces,
          (line.notes ?? "").trim() || null,
        ]
      );
    }

    return NextResponse.json({ ok: true, id: body.id });
  } catch (err: any) {
    console.error("emblem-production-update POST error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
