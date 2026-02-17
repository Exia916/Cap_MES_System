import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import { db } from "@/lib/db";

type MachineRow = {
  id: string;
  machineNumber: number;
  name: string | null;
};

type Resp = { machines: MachineRow[] } | { error: string };

export async function GET(req: NextRequest) {
  const auth = getAuthFromRequest(req);
  if (!auth) return NextResponse.json<Resp>({ error: "Unauthorized" }, { status: 401 });

  try {
    // Find which column exists for machine number
    const cols = await db.query<{ column_name: string }>(
      `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'machines'
      `
    );

    const set = new Set(cols.rows.map((r) => r.column_name));

    // Pick the first match in preferred order
    const machineCol =
      (set.has("machine_number") && "machine_number") ||
      (set.has("machine_no") && "machine_no") ||
      (set.has("machine_num") && "machine_num") ||
      (set.has("number") && "number") ||
      (set.has("machine") && "machine") ||
      null;

    if (!machineCol) {
      return NextResponse.json<Resp>(
        { error: "Machines table missing a machine number column (expected machine_number/machine_no/number/etc.)" },
        { status: 500 }
      );
    }

    // name column is optional
    const nameCol = set.has("name") ? "name" : null;

    const sql = `
      SELECT
        id,
        ${machineCol} AS "machineNumber"
        ${nameCol ? `, ${nameCol} AS "name"` : `, NULL::text AS "name"`}
      FROM machines
      ORDER BY ${machineCol} ASC
    `;

    const result = await db.query<MachineRow>(sql);
    return NextResponse.json<Resp>({ machines: result.rows }, { status: 200 });
  } catch (err) {
    console.error("machines GET error:", err);
    return NextResponse.json<Resp>({ error: "Server error" }, { status: 500 });
  }
}
