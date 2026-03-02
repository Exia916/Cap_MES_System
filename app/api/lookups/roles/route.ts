// app/api/lookups/roles/route.ts
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

    // IMPORTANT: only return roles that are valid enum values in Postgres
    // This prevents someone adding a role in roles_lookup that the enum won't accept.
    const res = await db.query(`
      SELECT rl.code, rl.label, rl.is_active, rl.sort_order
      FROM roles_lookup rl
      JOIN unnest(enum_range(NULL::role)) AS e(role_value)
        ON rl.code = e.role_value::text
      WHERE rl.is_active = true
      ORDER BY rl.sort_order ASC, rl.code ASC
    `);

    return NextResponse.json({ roles: res.rows });
  } catch (err: any) {
    console.error("GET /api/lookups/roles failed:", err);
    return NextResponse.json(
      { error: process.env.NODE_ENV === "production" ? "Failed to load roles" : err?.message || "Failed to load roles" },
      { status: 500 }
    );
  }
}