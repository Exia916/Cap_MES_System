import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyJwt } from "@/lib/auth";
import { db } from "@/lib/db";

type Line = {
  detailNumber?: string | number | null;
  emblemType?: string | null;
  logoName?: string | null;
  pieces: string | number;
  notes?: string | null;
};

type Body = {
  entryDate: string; // YYYY-MM-DD
  salesOrder: string | number;
  headerNotes?: string | null;
  lines: Line[];
};

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const payload = verifyJwt(token);
    if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = (await req.json()) as Body;

    const salesOrder = Number(body.salesOrder);
    if (!body.entryDate) return NextResponse.json({ error: "entryDate is required" }, { status: 400 });
    if (!Number.isFinite(salesOrder)) return NextResponse.json({ error: "salesOrder is required" }, { status: 400 });
    if (!Array.isArray(body.lines) || body.lines.length === 0) {
      return NextResponse.json({ error: "At least one line is required" }, { status: 400 });
    }

    const name = payload.displayName ?? payload.username ?? "Unknown";
    const employeeNumber =
      payload.employeeNumber !== undefined && payload.employeeNumber !== null && payload.employeeNumber !== ""
        ? Number(payload.employeeNumber)
        : null;

    const client = await db.connect();
    try {
      await client.query("BEGIN");

      const headerRes = await client.query<{ id: string }>(
        `
        INSERT INTO emblem_daily_submissions (entry_date, sales_order, name, employee_number, notes)
        VALUES ($1::date, $2::bigint, $3::text, $4::int, $5::text)
        RETURNING id
        `,
        [body.entryDate, salesOrder, name, employeeNumber, (body.headerNotes ?? "").trim() || null]
      );

      const submissionId = headerRes.rows[0]?.id;
      if (!submissionId) throw new Error("Failed to create submission");

      for (const line of body.lines) {
        const pieces = Number(line.pieces);
        if (!Number.isFinite(pieces)) throw new Error("Each line needs a valid pieces");

        const detailNumber =
          line.detailNumber === undefined || line.detailNumber === null || line.detailNumber === ""
            ? null
            : Number(line.detailNumber);

        await client.query(
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

      await client.query("COMMIT");
      return NextResponse.json({ ok: true, id: submissionId });
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.error("emblem-production-submission POST error:", err);
    return NextResponse.json({ error: err?.message || "Server error" }, { status: 500 });
  }
}
