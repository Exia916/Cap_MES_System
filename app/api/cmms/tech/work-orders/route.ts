import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import { listWorkOrdersTechPaged } from "@/lib/repositories/cmmsRepo";

export const runtime = "nodejs";

const ALLOWED = new Set(["ADMIN", "TECH"]);
function ok(role: any) {
  return ALLOWED.has(String(role || "").toUpperCase());
}

export async function GET(req: NextRequest) {
  try {
    const auth = getAuthFromRequest(req);
    if (!auth) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    if (!ok((auth as any).role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const url = new URL(req.url);

    const pageIndex = Math.max(0, Number(url.searchParams.get("pageIndex") || "0") || 0);
    const pageSize = Math.min(Math.max(Number(url.searchParams.get("pageSize") || "25") || 25, 1), 250);

    const sortBy = (url.searchParams.get("sortBy") || "requestedAt").trim();
    const sortDir = (url.searchParams.get("sortDir") || "desc").trim().toLowerCase() === "asc" ? "asc" : "desc";

    const requestedFrom = (url.searchParams.get("requestedFrom") || "").trim() || undefined;
    const requestedTo = (url.searchParams.get("requestedTo") || "").trim() || undefined;

    const filters: Record<string, string> = {};
    for (const [k, v] of url.searchParams.entries()) {
      if (k.startsWith("f_") && v.trim()) filters[k.slice(2)] = v.trim();
    }

    const data = await listWorkOrdersTechPaged({
      pageIndex,
      pageSize,
      sortBy,
      sortDir,
      requestedFrom,
      requestedTo,
      filters,
    });

    return NextResponse.json(data, { status: 200 });
  } catch (e: any) {
    console.error("CMMS TECH GET /work-orders failed:", e);
    return NextResponse.json({ error: e?.message || "Failed to load" }, { status: 500 });
  }
}