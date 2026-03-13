import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import { getAssets, getLookup } from "@/lib/repositories/cmmsRepo";
import { logError, logWarn } from "@/lib/logging/logger";

export const runtime = "nodejs";

const ALLOWED_ROLES = new Set(["ADMIN", "MANAGER", "SUPERVISOR", "TECH"]);

function toInt(v: string | null): number | undefined {
  if (!v || !v.trim()) return undefined;
  const n = Number(v);
  if (!Number.isFinite(n)) return undefined;
  return Math.trunc(n);
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ kind: string }> }) {
  let auth: ReturnType<typeof getAuthFromRequest> | null = null;
  let kind: string | null = null;

  try {
    auth = getAuthFromRequest(req);

    if (!auth) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    if (!ALLOWED_ROLES.has(String((auth as any).role || "").toUpperCase())) {
      await logWarn({
        req,
        auth,
        category: "API",
        module: "CMMS",
        eventType: "CMMS_LOOKUP_FORBIDDEN",
        message: "User attempted to access CMMS lookup data without permission",
      });

      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const params = await ctx.params;
    kind = String(params?.kind || "").trim();

    if (kind === "assets") {
      const url = new URL(req.url);
      const depRaw = url.searchParams.get("departmentId");

      if (depRaw != null && depRaw.trim() !== "" && toInt(depRaw) == null) {
        await logWarn({
          req,
          auth,
          category: "API",
          module: "CMMS",
          eventType: "CMMS_ASSET_LOOKUP_INVALID_DEPARTMENT",
          message: "CMMS asset lookup received invalid departmentId",
          details: {
            departmentId: depRaw,
          },
        });

        return NextResponse.json({ error: "Invalid departmentId" }, { status: 400 });
      }

      const departmentId = toInt(depRaw);
      const rows = await getAssets(departmentId);

      return NextResponse.json({ rows }, { status: 200 });
    }

    const rows = await getLookup(kind);
    return NextResponse.json({ rows }, { status: 200 });
  } catch (e: any) {
    await logError({
      req,
      auth,
      category: "API",
      module: "CMMS",
      eventType: kind === "assets" ? "CMMS_ASSET_LOOKUP_ERROR" : "CMMS_LOOKUP_ERROR",
      message: kind === "assets" ? "Failed to load CMMS asset lookup data" : "Failed to load CMMS lookup data",
      error: e,
      details: {
        kind,
        code: e?.code ?? null,
        detail: e?.detail ?? null,
      },
    });

    return NextResponse.json({ error: e?.message || "Lookup failed" }, { status: 500 });
  }
}