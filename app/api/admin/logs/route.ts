import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import { listAppLogsPaged, type LogSortDir } from "@/lib/repositories/logsRepo";
import { logError } from "@/lib/logging/logger";

export const runtime = "nodejs";

const ALLOWED_ROLES = new Set(["ADMIN"]);

function roleOk(role: string | null | undefined) {
  return ALLOWED_ROLES.has(String(role || "").trim().toUpperCase());
}

function toStr(v: string | null) {
  return (v || "").trim();
}

function toPage(v: string | null, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : fallback;
}

function toSortDir(v: string | null): LogSortDir {
  return String(v || "").toLowerCase() === "asc" ? "asc" : "desc";
}

export async function GET(req: NextRequest) {
  try {
    const auth = getAuthFromRequest(req);
    if (!auth) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    if (!roleOk(auth.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);

    const page = toPage(searchParams.get("page"), 1);
    const pageSize = toPage(searchParams.get("pageSize"), 25);
    const sortBy = toStr(searchParams.get("sortBy")) || "created_at";
    const sortDir = toSortDir(searchParams.get("sortDir"));

    const filters = {
      level: toStr(searchParams.get("level")),
      category: toStr(searchParams.get("category")),
      event_type: toStr(searchParams.get("event_type")),
      module: toStr(searchParams.get("module")),
      username: toStr(searchParams.get("username")),
      route: toStr(searchParams.get("route")),
      message: toStr(searchParams.get("message")),
    };

    const result = await listAppLogsPaged({
      page,
      pageSize,
      sortBy,
      sortDir,
      filters,
    });

    return NextResponse.json(result);
  } catch (error) {
    await logError({
      req,
      category: "API",
      module: "ADMIN",
      eventType: "ADMIN_LOGS_LIST_ERROR",
      message: "Failed to load admin logs",
      error,
    });

    return NextResponse.json({ error: "Failed to load logs" }, { status: 500 });
  }
}