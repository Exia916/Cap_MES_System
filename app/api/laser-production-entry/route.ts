import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import { db } from "@/lib/db";

type PostBody = {
  entryTs?: string;
  salesOrder?: number | string | null;
  leatherStyleColor?: string | null;
  piecesCut?: number | string | null;
  notes?: string | null;
};

type Resp = { success: true; id: string } | { error: string };

function toNullableBigint(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;
  const s = String(v).trim();
  if (!/^-?\d+$/.test(s)) return null;
  return s;
}

function toNullableInt(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).trim());
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function toNullableStr(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

export async function POST(req: NextRequest) {
  const auth = getAuthFromRequest(req);
  if (!auth) return NextResponse.json<Resp>({ error: "Unauthorized" }, { status: 401 });

  let body: PostBody;
  try {
    body = (await req.json()) as PostBody;
  } catch {
    return NextResponse.json<Resp>({ error: "Invalid JSON body" }, { status: 400 });
  }

  const entryTs = body.entryTs ? new Date(body.entryTs) : new Date();
  if (Number.isNaN(entryTs.getTime())) {
    return NextResponse.json<Resp>({ error: "Invalid entryTs" }, { status: 400 });
  }

  try {
    const sql = `
      INSERT INTO laser_entries (
        entry_ts,
        entry_date,
        name,
        employee_number,
        sales_order,
        leather_style_color,
        pieces_cut,
        notes
      )
      VALUES (
        $1,
        (($1 AT TIME ZONE 'America/Chicago')::date),
        $2,
        $3,
        $4::bigint,
        $5,
        $6,
        $7
      )
      RETURNING id
    `;

    const params = [
      entryTs,
      auth.name,
      auth.employeeNumber,
      toNullableBigint(body.salesOrder),
      toNullableStr(body.leatherStyleColor),
      toNullableInt(body.piecesCut),
      toNullableStr(body.notes),
    ];

    const result = await db.query<{ id: string }>(sql, params);
    return NextResponse.json<Resp>({ success: true, id: result.rows[0].id }, { status: 200 });
  } catch (err) {
    console.error("laser-production-entry POST error:", err);
    return NextResponse.json<Resp>({ error: "Server error" }, { status: 500 });
  }
}
