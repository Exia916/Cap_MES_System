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
    const salesOrder = body.salesOrder as string;
    const leatherStyleColor = body.leatherStyleColor as string;
    const piecesCut = body.piecesCut as string | number;
    const notes = (body.notes as string) ?? "";

    if (!salesOrder) {
      return NextResponse.json({ error: "salesOrder is required" }, { status: 400 });
    }

    if (!leatherStyleColor) {
      return NextResponse.json({ error: "leatherStyleColor is required" }, { status: 400 });
    }

    const soNum = Number(salesOrder);
    if (!Number.isFinite(soNum)) {
      return NextResponse.json({ error: "salesOrder must be a number" }, { status: 400 });
    }

    const piecesNum = Number(piecesCut);
    if (!Number.isFinite(piecesNum) || piecesNum < 0) {
      return NextResponse.json({ error: "piecesCut must be a non-negative number" }, { status: 400 });
    }

    // IMPORTANT:
    // laser_entries.name and laser_entries.employee_number are FK-backed,
    // so use the actual users table row instead of trusting JWT display fields.
    const username = String(payload.username ?? "").trim();
    if (!username) {
      return NextResponse.json({ error: "Authenticated username not found" }, { status: 400 });
    }

    const userRes = await db.query<{ name: string; employee_number: number | null }>(
      `
      SELECT name, employee_number
      FROM public.users
      WHERE username = $1
      LIMIT 1
      `,
      [username]
    );

    if (!userRes.rows.length) {
      return NextResponse.json({ error: "User not found" }, { status: 400 });
    }

    const name = userRes.rows[0].name;
    const employeeNumber = userRes.rows[0].employee_number;

    const { rows } = await db.query<{ id: string }>(
      `
      INSERT INTO public.laser_entries (
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
        $1::text,
        $2::int,
        $3::bigint,
        $4::text,
        $5::int,
        $6::text
      )
      RETURNING id
      `,
      [name, employeeNumber, soNum, leatherStyleColor, piecesNum, notes || null]
    );

    return NextResponse.json({ ok: true, id: rows[0]?.id });
  } catch (err: any) {
    console.error("laser-production-add POST error:", err);
    return NextResponse.json({ error: err?.message || "Server error" }, { status: 500 });
  }
}