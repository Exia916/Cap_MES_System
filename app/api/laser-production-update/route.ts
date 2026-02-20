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

    const id = body.id as string;
    const salesOrder = body.salesOrder as string;
    const leatherStyleColor = body.leatherStyleColor as string;
    const piecesCut = body.piecesCut as string | number;
    const notes = (body.notes as string) ?? "";

    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
    if (!salesOrder) return NextResponse.json({ error: "Sales Order is required" }, { status: 400 });
    if (!leatherStyleColor)
      return NextResponse.json({ error: "Leather Style/Color is required" }, { status: 400 });

    const soNum = Number(salesOrder);
    if (!Number.isFinite(soNum))
      return NextResponse.json({ error: "Sales Order must be numeric" }, { status: 400 });

    const piecesNum = Number(piecesCut);
    if (!Number.isFinite(piecesNum) || piecesNum < 0)
      return NextResponse.json({ error: "Pieces Cut must be a non-negative number" }, { status: 400 });

    // ✅ Keep FK integrity: ensure we update only rows belonging to this user (by name + employee_number)
    // Your FK is laser_entries.name -> users(name) and laser_entries.employee_number -> users(employee_number)
    const userRes = await db.query(
      `SELECT name, employee_number FROM users WHERE username = $1`,
      [payload.username]
    );

    if (!userRes.rows.length) {
      return NextResponse.json({ error: "User not found" }, { status: 400 });
    }

    const name = userRes.rows[0].name;
    const employeeNumber = userRes.rows[0].employee_number;

    const result = await db.query(
      `
      UPDATE laser_entries
      SET
        sales_order = $1::bigint,
        leather_style_color = $2::text,
        pieces_cut = $3::int,
        notes = $4::text
      WHERE id = $5::uuid
        AND name = $6::text
        AND employee_number = $7::int
      `,
      [soNum, leatherStyleColor, piecesNum, notes, id, name, employeeNumber]
    );

    // If no rows updated, it was either not found OR not owned by user
    if (result.rowCount === 0) {
      return NextResponse.json(
        { error: "Entry not found (or not owned by current user)" },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("laser-production-update POST error:", err);
    return NextResponse.json({ error: err?.message || "Server error" }, { status: 500 });
  }
}
