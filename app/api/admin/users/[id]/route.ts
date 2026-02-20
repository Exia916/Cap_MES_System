// app/api/admin/users/[id]/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyJwt } from "@/lib/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";

async function requireAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value; // ✅ FIXED
  if (!token) return { ok: false as const, status: 401, error: "Unauthorized" };

  const payload: any = verifyJwt(token);
  if (!payload) return { ok: false as const, status: 401, error: "Unauthorized" };

  if ((payload.role || "").toUpperCase() !== "ADMIN") {
    return { ok: false as const, status: 403, error: "Forbidden" };
  }

  return { ok: true as const, payload };
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const id = params.id;
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  try {
    await db.query(
      `UPDATE users SET is_active = false, updated_at = NOW() WHERE id = $1`,
      [id]
    );
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("DELETE /api/admin/users/[id] failed:", err);
    return NextResponse.json(
      { error: process.env.NODE_ENV === "production" ? "Failed to deactivate user" : err?.message || "Failed to deactivate user" },
      { status: 500 }
    );
  }
}