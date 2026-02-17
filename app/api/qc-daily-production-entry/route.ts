import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import { db } from "@/lib/db";

type PostBody = {
  entryTs?: string; // ISO timestamp; optional
  salesOrder?: number | string | null;
  detailNumber?: number | string | null;
  flatOr3D?: string | null;
  orderQuantity?: number | string | null;
  inspectedQuantity?: number | string | null;
  rejectedQuantity?: number | string | null;
  quantityShipped?: number | string | null;
  notes?: string | null;
};

type Resp = { success: true; id: string } | { error: string };

function toNullableBigint(v: unknown): string | null {
  // pg can accept bigint as string; avoids JS precision issues
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

  // Store entry_date as Central date derived from entry_ts
  try {
    const sql = `
      INSERT INTO qc_daily_entries (
        entry_ts,
        entry_date,
        name,
        employee_number,
        sales_order,
        detail_number,
        flat_or_3d,
        order_quantity,
        inspected_quantity,
        rejected_quantity,
        quantity_shipped,
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
        $7,
        $8,
        $9,
        $10,
        $11
      )
      RETURNING id
    `;

    const params = [
      entryTs,
      auth.name,
      auth.employeeNumber,
      toNullableBigint(body.salesOrder),
      toNullableInt(body.detailNumber),
      toNullableStr(body.flatOr3D),
      toNullableInt(body.orderQuantity),
      toNullableInt(body.inspectedQuantity),
      toNullableInt(body.rejectedQuantity),
      toNullableInt(body.quantityShipped),
      toNullableStr(body.notes),
    ];

    const result = await db.query<{ id: string }>(sql, params);
    return NextResponse.json<Resp>({ success: true, id: result.rows[0].id }, { status: 200 });
  } catch (err) {
    console.error("qc-daily-production-entry POST error:", err);
    return NextResponse.json<Resp>({ error: "Server error" }, { status: 500 });
  }
}

