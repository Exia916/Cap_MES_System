// app/api/admin/_shared/adminAuth.ts
import { cookies } from "next/headers";
import { verifyJwt } from "@/lib/auth";

export const ADMIN_ROLES = ["ADMIN", "SUPERVISOR", "MANAGER"] as const;

export type AdminRole = (typeof ADMIN_ROLES)[number];

export async function requireManagerOrAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;

  if (!token) {
    return { ok: false as const, status: 401, error: "Unauthorized" };
  }

  const payload: any = verifyJwt(token);
  if (!payload) {
    return { ok: false as const, status: 401, error: "Unauthorized" };
  }

  const role = String(payload.role || "").toUpperCase();
  if (!ADMIN_ROLES.includes(role as any)) {
    return { ok: false as const, status: 403, error: "Forbidden" };
  }

  return { ok: true as const, payload };
}