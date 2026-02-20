import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyJwt } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(req: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const payload = verifyJwt(token);
    if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

    const { rows } = await db.query(
      `
      SELECT
        id,
        to_char(entry_date, 'YYYY-MM-DD') as entry_date,
        sales_order::text as sales_order,
        leather_style_color,
        pieces_cut,
        notes
      FROM laser_entries
      WHERE id = $1::uuid
      LIMIT 1
      `,
      [id]
    );

    const row = rows[0];
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json({ row });
  } catch (err: any) {
    console.error("laser-production-entry GET error:", err);
    return NextResponse.json({ error: err?.message || "Server error" }, { status: 500 });
  }
}
