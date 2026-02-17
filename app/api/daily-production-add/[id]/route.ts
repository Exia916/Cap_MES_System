import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import { db } from "@/lib/db";

type GetResp =
  | { entry: EmbroideryEntry }
  | { error: string };

type PutBody = {
  machineNumber?: number | string | null;
  salesOrder?: number | string | null;      // bigint
  detailNumber?: number | string | null;
  embroideryLocation?: string | null;
  stitches?: number | string | null;
  pieces?: number | string | null;
  is3d?: boolean;
  isKnit?: boolean;
  detailComplete?: boolean;
  notes?: string | null;
};

type PutResp =
  | { success: true }
  | { error: string };

type EmbroideryEntry = {
  id: string;
  entryTs: string;
  shiftDate: string;
  name: string;
  employeeNumber: number;
  shift: string;
  machineNumber: number | null;
  salesOrder: string | null; // bigint -> string
  detailNumber: number | null;
  embroideryLocation: string | null;
  stitches: number | null;
  pieces: number | null;
  is3d: boolean | null;
  isKnit: boolean | null;
  detailComplete: boolean | null;
  notes: string | null;
  totalStitches: string | null; // bigint -> string
  dozens: string | null;        // numeric -> string
};

function toNullableInt(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).trim());
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function toNullableBigint(v: unknown): string | null {
  // Send bigint to PG as string to avoid JS precision issues
  if (v === null || v === undefined || v === "") return null;
  const s = String(v).trim();
  return /^-?\d+$/.test(s) ? s : null;
}

function toNullableStr(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

export async function GET(
  req: NextRequest,
  ctx: { params: { id: string } }
) {
  const auth = getAuthFromRequest(req);
  if (!auth) return NextResponse.json<GetResp>({ error: "Unauthorized" }, { status: 401 });

  const id = ctx.params.id;

  try {
    const sql = `
      SELECT
        id,
        entry_ts AS "entryTs",
        shift_date AS "shiftDate",
        name,
        employee_number AS "employeeNumber",
        shift,
        machine_number AS "machineNumber",
        sales_order::text AS "salesOrder",
        detail_number AS "detailNumber",
        embroidery_location AS "embroideryLocation",
        stitches,
        pieces,
        is_3d AS "is3d",
        is_knit AS "isKnit",
        detail_complete AS "detailComplete",
        notes,
        total_stitches::text AS "totalStitches",
        dozens::text AS "dozens"
      FROM embroidery_daily_entries
      WHERE id = $1 AND employee_number = $2
      LIMIT 1
    `;

    const result = await db.query<EmbroideryEntry>(sql, [id, auth.employeeNumber]);
    const entry = result.rows[0];

    if (!entry) {
      return NextResponse.json<GetResp>({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json<GetResp>({ entry }, { status: 200 });
  } catch (err) {
    console.error("daily-production-entry GET error:", err);
    return NextResponse.json<GetResp>({ error: "Server error" }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  ctx: { params: { id: string } }
) {
  const auth = getAuthFromRequest(req);
  if (!auth) return NextResponse.json<PutResp>({ error: "Unauthorized" }, { status: 401 });

  const id = ctx.params.id;

  let body: PutBody;
  try {
    body = (await req.json()) as PutBody;
  } catch {
    return NextResponse.json<PutResp>({ error: "Invalid JSON body" }, { status: 400 });
  }

  const machineNumber = toNullableInt(body.machineNumber);
  const salesOrder = toNullableBigint(body.salesOrder);
  const detailNumber = toNullableInt(body.detailNumber);
  const embroideryLocation = toNullableStr(body.embroideryLocation);
  const stitches = toNullableInt(body.stitches);
  const pieces = toNullableInt(body.pieces);
  const is3d = body.is3d === undefined ? null : Boolean(body.is3d);
  const isKnit = body.isKnit === undefined ? null : Boolean(body.isKnit);
  const detailComplete = body.detailComplete === undefined ? null : Boolean(body.detailComplete);
  const notes = toNullableStr(body.notes);

  try {
    // Also recompute total_stitches and dozens from stitches/pieces (matches your columns)
    const sql = `
      UPDATE embroidery_daily_entries
      SET
        machine_number = $3,
        sales_order = $4::bigint,
        detail_number = $5,
        embroidery_location = $6,
        stitches = $7,
        pieces = $8,
        is_3d = $9,
        is_knit = $10,
        detail_complete = $11,
        notes = $12,
        total_stitches = (COALESCE($7, 0)::bigint * COALESCE($8, 0)::bigint),
        dozens = (COALESCE($8, 0)::numeric / 12)
      WHERE id = $1 AND employee_number = $2
    `;

    await db.query(sql, [
      id,
      auth.employeeNumber,
      machineNumber,
      salesOrder,
      detailNumber,
      embroideryLocation,
      stitches,
      pieces,
      is3d,
      isKnit,
      detailComplete,
      notes,
    ]);

    return NextResponse.json<PutResp>({ success: true }, { status: 200 });
  } catch (err) {
    console.error("daily-production-entry PUT error:", err);
    return NextResponse.json<PutResp>({ error: "Server error" }, { status: 500 });
  }
}
