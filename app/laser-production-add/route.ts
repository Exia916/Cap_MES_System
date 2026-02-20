import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyJwt } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const payload = verifyJwt(token);
    if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const entryDate = body.entryDate as string; // YYYY-MM-DD
    const salesOrder = body.salesOrder as string;
    const leatherStyleColor = body.leatherStyleColor as string;
    const piecesCut = body.piecesCut as string | number;
    const notes = (body.notes as string) ?? "";

    if (!entryDate) return NextResponse.json({ error: "entryDate is required" }, { status: 400 });
    if (!salesOrder) return NextResponse.json({ error: "salesOrder is required" }, { status: 400 });
    if (!leatherStyleColor) return NextResponse.json({ error: "leatherStyleColor is required" }, { status: 400 });

    const soNum = Number(salesOrder);
    if (!Number.isFinite(soNum)) return NextResponse.json({ error: "salesOrder must be a number" }, { status: 400 });

    const piecesNum = Number(piecesCut);
    if (!Number.isFinite(piecesNum) || piecesNum < 0) {
      return NextResponse.json({ error: "piecesCut must be a non-negative number" }, { status: 400 });
    }

    const name = payload.displayName ?? payload.username ?? "Unknown";
    const employeeNumber = payload.employeeNumber ? Number(payload.employeeNumber) : null;

    const { rows } = await db.query(
      `
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
        NOW(),
        $1::date,
        $2::text,
        $3::int,
        $4::bigint,
        $5::text,
        $6::int,
        $7::text
      )
      RETURNING id
      `,
      [entryDate, name, employeeNumber, soNum, leatherStyleColor, piecesNum, notes]
    );

    return NextResponse.json({ ok: true, id: rows[0]?.id });
  } catch (err: any) {
    console.error("laser-production-add POST error:", err);
    return NextResponse.json({ error: err?.message || "Server error" }, { status: 500 });
  }
}
