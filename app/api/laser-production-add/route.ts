import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyJwt } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;
    if (!token)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const payload = verifyJwt(token);
    if (!payload)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();

    const salesOrder = body.salesOrder as string;
    const leatherStyleColor = body.leatherStyleColor as string;
    const piecesCut = body.piecesCut as string | number;
    const notes = (body.notes as string) ?? "";

    if (!salesOrder)
      return NextResponse.json({ error: "Sales Order is required" }, { status: 400 });

    if (!leatherStyleColor)
      return NextResponse.json({ error: "Leather Style/Color is required" }, { status: 400 });

    const soNum = Number(salesOrder);
    if (!Number.isFinite(soNum))
      return NextResponse.json({ error: "Sales Order must be numeric" }, { status: 400 });

    const piecesNum = Number(piecesCut);
    if (!Number.isFinite(piecesNum) || piecesNum < 0)
      return NextResponse.json({ error: "Pieces Cut must be a non-negative number" }, { status: 400 });

    // ✅ FETCH correct name from users table
    const userRes = await db.query(
      `SELECT name, employee_number FROM users WHERE username = $1`,
      [payload.username]
    );

    if (!userRes.rows.length) {
      return NextResponse.json({ error: "User not found" }, { status: 400 });
    }

    const name = userRes.rows[0].name;
    const employeeNumber = userRes.rows[0].employee_number;

    await db.query(
      `
      INSERT INTO laser_entries (
        entry_ts,
        name,
        employee_number,
        sales_order,
        leather_style_color,
        pieces_cut,
        notes
      )
      VALUES (
        NOW(),
        $1,
        $2,
        $3,
        $4,
        $5,
        $6
      )
      `,
      [name, employeeNumber, soNum, leatherStyleColor, piecesNum, notes]
    );

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("laser-production-add POST error:", err);
    return NextResponse.json(
      { error: err?.message || "Server error" },
      { status: 500 }
    );
  }
}
