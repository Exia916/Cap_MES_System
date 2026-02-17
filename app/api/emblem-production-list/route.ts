import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import { db } from "@/lib/db";

type EmblemEntry = {
  id: string;
  entryTs: string;
  entryDate: string;
  salesOrder: string | null; // bigint -> string
  detailNumber: number | null;
  emblemType: string | null;
  logoName: string | null;
  pieces: number | null;
  notes: string | null;
};

type Resp = { entries: EmblemEntry[] } | { error: string };

function isValidDate(v: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(v);
}

export async function GET(req: NextRequest) {
  const auth = getAuthFromRequest(req);
  if (!auth) return NextResponse.json<Resp>({ error: "Unauthorized" }, { status: 401 });

  const entryDate = req.nextUrl.searchParams.get("entryDate")?.trim() ?? "";
  if (!isValidDate(entryDate)) {
    return NextResponse.json<Resp>({ error: "Missing/invalid entryDate (YYYY-MM-DD)" }, { status: 400 });
  }

  try {
    const sql = `
      SELECT
        id,
        entry_ts AS "entryTs",
        entry_date AS "entryDate",
        sales_order::text AS "salesOrder",
        detail_number AS "detailNumber",
        emblem_type AS "emblemType",
        logo_name AS "logoName",
        pieces,
        notes
      FROM emblem_entries
      WHERE employee_number = $1 AND entry_date = $2
      ORDER BY entry_ts DESC
    `;

    const result = await db.query<EmblemEntry>(sql, [auth.employeeNumber, entryDate]);
    return NextResponse.json<Resp>({ entries: result.rows }, { status: 200 });
  } catch (err) {
    console.error("emblem-production-list GET error:", err);
    return NextResponse.json<Resp>({ error: "Server error" }, { status: 500 });
  }
}
