import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import { updateWorkOrderTechFields } from "@/lib/repositories/cmmsRepo";

export const runtime = "nodejs";

const ALLOWED = new Set(["ADMIN", "TECH"]);
function ok(role: any) {
  return ALLOWED.has(String(role || "").toUpperCase());
}

function toInt(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return Math.trunc(v);
  if (typeof v === "string" && v.trim()) {
    const n = Number(v);
    if (Number.isFinite(n)) return Math.trunc(n);
  }
  return null;
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const auth = getAuthFromRequest(req);
    if (!auth) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    if (!ok((auth as any).role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id: idStr } = await ctx.params;
    const id = toInt(idStr);
    if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });

    const typeId = (body as any).typeId === "" || (body as any).typeId == null ? null : toInt((body as any).typeId);
    const techId = (body as any).techId === "" || (body as any).techId == null ? null : toInt((body as any).techId);
    const statusId = (body as any).statusId === "" || (body as any).statusId == null ? null : toInt((body as any).statusId);

    const resolution = String((body as any).resolution || "").trim() || null;
    const downTimeRecorded = String((body as any).downTimeRecorded || "").trim() || null;

    const updated = await updateWorkOrderTechFields({
      id,
      typeId: typeId ?? null,
      techId: techId ?? null,
      statusId: statusId ?? null,
      resolution,
      downTimeRecorded,
    });

    return NextResponse.json({ ok: true, workOrderId: updated.workOrderId }, { status: 200 });
  } catch (e: any) {
    console.error("CMMS TECH PATCH /work-orders/[id] failed:", e);
    return NextResponse.json({ error: e?.message || "Update failed", code: e?.code, detail: e?.detail }, { status: 500 });
  }
}