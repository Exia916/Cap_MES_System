// app/api/lookups/shifts/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyJwt } from "@/lib/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";

async function getAuth() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) return null;
  return verifyJwt(token);
}

export async function GET() {
  try {
    const payload: any = await getAuth();
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const res = await db.query(
      `
      SELECT id, code, name, start_time, is_active, sort_order
      FROM shifts
      WHERE is_active = true
      ORDER BY sort_order ASC, name ASC
      `
    );

    return NextResponse.json({ shifts: res.rows });
  } catch (err) {
    console.error("GET /api/lookups/shifts failed:", err);
    return NextResponse.json({ error: "Failed to load shifts" }, { status: 500 });
  }
}