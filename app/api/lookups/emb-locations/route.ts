import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cookies } from "next/headers";
import { verifyJwt } from "@/lib/auth";

export const runtime = "nodejs";

async function requireAuth() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) return null;
  return verifyJwt(token);
}

export async function GET() {
  const auth = await requireAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const res = await db.query(
    `SELECT code, label
     FROM emb_locations
     WHERE is_active = true
     ORDER BY sort_order ASC, code ASC`
  );

  return NextResponse.json({
    options: res.rows.map((r) => ({ value: r.code, label: r.label ? `${r.label} (${r.code})` : r.code })),
    rows: res.rows,
  });
}