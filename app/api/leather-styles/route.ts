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
    `SELECT style_color
     FROM leather_styles
     WHERE is_active = true
     ORDER BY style_color ASC`
  );

  const styles = res.rows.map((r) => r.style_color);

  return NextResponse.json({
    styles,
    options: styles.map((s) => ({ value: s, label: s })),
  });
}