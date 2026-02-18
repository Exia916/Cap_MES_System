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

    const { rows } = await db.query<{ emb_type: string }>(
      `
      SELECT DISTINCT emb_type
      FROM emb_type_locations
      WHERE emb_type IS NOT NULL
        AND TRIM(emb_type) <> ''
        AND (is_active IS NULL OR is_active = true)
      ORDER BY emb_type ASC
      `
    );

    return NextResponse.json({ types: rows.map((r) => r.emb_type) });
  } catch (err: any) {
    console.error("emblem-types GET error:", err);
    return NextResponse.json({ error: err?.message || "Server error" }, { status: 500 });
  }
}
