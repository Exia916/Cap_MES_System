import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyJwt } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const payload = verifyJwt(token);
    if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { rows } = await db.query<{ style_color: string }>(
      `
      SELECT DISTINCT style_color
      FROM leather_styles
      WHERE style_color IS NOT NULL
        AND TRIM(style_color) <> ''
        AND (is_active IS NULL OR is_active = true)
      ORDER BY style_color ASC
      `
    );

    return NextResponse.json({ styles: rows.map((r) => r.style_color) });
  } catch (err: any) {
    console.error("leather-styles GET error:", err);
    return NextResponse.json({ error: err?.message || "Server error" }, { status: 500 });
  }
}
