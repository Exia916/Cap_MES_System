import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyJwt } from "@/lib/auth";
import { db } from "@/lib/db";
import { isMasterKey, MASTER_DATA, type MasterKey } from "../registry";

export const runtime = "nodejs";

async function requireAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) return { ok: false as const, status: 401, error: "Unauthorized" };

  const payload: any = verifyJwt(token);
  if (!payload) return { ok: false as const, status: 401, error: "Unauthorized" };

  if ((payload.role || "").toUpperCase() !== "ADMIN") {
    return { ok: false as const, status: 403, error: "Forbidden" };
  }

  return { ok: true as const, payload };
}

function bad(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}

function pickEditable(key: MasterKey, body: any) {
  const cfg = MASTER_DATA[key];
  const allowed = new Set(cfg.editable as unknown as string[]);
  const data: Record<string, any> = {};
  for (const k of Object.keys(body || {})) {
    if (allowed.has(k)) data[k] = body[k];
  }
  return data;
}

function normalizeCommon(data: Record<string, any>) {
  if (typeof data.code === "string") data.code = data.code.trim().toUpperCase();
  if (typeof data.name === "string") data.name = data.name.trim();
  if (typeof data.label === "string") data.label = data.label.trim();
  if (typeof data.location === "string") data.location = data.location.trim();
  if (typeof data.emb_type === "string") data.emb_type = data.emb_type.trim();
  if (typeof data.flat_or_3d === "string") data.flat_or_3d = data.flat_or_3d.trim();
  if (typeof data.location_code === "string") data.location_code = data.location_code.trim().toUpperCase();
  if (typeof data.emb_type_code === "string") data.emb_type_code = data.emb_type_code.trim().toUpperCase();
  if (typeof data.flat_or_3d_code === "string") data.flat_or_3d_code = data.flat_or_3d_code.trim().toUpperCase();
  if (typeof data.style_color === "string") data.style_color = data.style_color.trim();

  if (data.sort_order !== undefined && data.sort_order !== null && data.sort_order !== "") {
    data.sort_order = Number(data.sort_order);
  }
  if (data.start_time !== undefined && data.start_time !== null && data.start_time !== "") {
    data.start_time = String(data.start_time).trim();
  }
  if (data.is_active !== undefined) {
    data.is_active = !!data.is_active;
  }
}

function validateRequiredForCreate(key: MasterKey, data: Record<string, any>): string | null {
  if (key === "departments" || key === "shifts") {
    if (!String(data.code || "").trim() || !String(data.name || "").trim()) return "code and name are required";
    return null;
  }

  if (key === "roles") {
    if (!String(data.code || "").trim() || !String(data.label || "").trim()) return "code and label are required";
    return null;
  }

  if (key === "emb_type_locations") {
    if (!String(data.location || "").trim() || !String(data.emb_type || "").trim() || !String(data.flat_or_3d || "").trim()) {
      return "location, emb_type, and flat_or_3d are required";
    }
    return null;
  }

  if (key === "emb_locations" || key === "emb_types" || key === "emb_flat_3d_options") {
    if (!String(data.code || "").trim() || !String(data.label || "").trim()) return "code and label are required";
    return null;
  }

  if (key === "emb_type_location_rules") {
    if (
      !String(data.location_code || "").trim() ||
      !String(data.emb_type_code || "").trim() ||
      !String(data.flat_or_3d_code || "").trim()
    ) {
      return "location_code, emb_type_code, and flat_or_3d_code are required";
    }
    return null;
  }

  if (key === "leather_styles") {
    if (!String(data.style_color || "").trim()) return "style_color is required";
    return null;
  }

  // fallback only if a table actually uses code
  if (MASTER_DATA[key].editable.includes("code" as any)) {
    if (!String(data.code || "").trim()) return "code is required";
  }

  return null;
}

export async function GET(_req: Request, ctx: { params: Promise<{ key: string }> }) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { key } = await ctx.params;
  if (!isMasterKey(key)) return bad("Invalid master data key", 404);

  const cfg = MASTER_DATA[key];
  const cols = cfg.selectCols.join(", ");

  try {
    const res = await db.query(`SELECT ${cols} FROM ${cfg.table} ORDER BY ${cfg.orderBy}`);
    return NextResponse.json({ rows: res.rows });
  } catch (err: any) {
    console.error(`GET /api/admin/master-data/${key} failed:`, err);
    return NextResponse.json(
      { error: process.env.NODE_ENV === "production" ? "Failed to load master data" : err?.message || "Failed to load master data" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request, ctx: { params: Promise<{ key: string }> }) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { key } = await ctx.params;
  if (!isMasterKey(key)) return bad("Invalid master data key", 404);

  const cfg = MASTER_DATA[key];
  const body = (await req.json().catch(() => null)) as any;
  if (!body) return bad("Invalid JSON body");

  const data = pickEditable(key as MasterKey, body);
  normalizeCommon(data);

  const reqErr = validateRequiredForCreate(key as MasterKey, data);
  if (reqErr) return bad(reqErr, 400);

  const cols = Object.keys(data);
  if (cols.length === 0) return bad("No editable fields provided", 400);

  const vals = cols.map((_, i) => `$${i + 1}`);
  const args = cols.map((c) => data[c]);

  try {
    const res = await db.query(
      `INSERT INTO ${cfg.table} (${cols.join(", ")})
       VALUES (${vals.join(", ")})
       RETURNING ${cfg.selectCols.join(", ")}`,
      args
    );
    return NextResponse.json({ row: res.rows[0] });
  } catch (err: any) {
    console.error(`POST /api/admin/master-data/${key} failed:`, err);

    const msg =
      String(err?.message || "").toLowerCase().includes("duplicate") ||
      String(err?.message || "").toLowerCase().includes("unique")
        ? "That value already exists."
        : process.env.NODE_ENV === "production"
        ? "Failed to create row"
        : err?.message || "Failed to create row";

    return NextResponse.json({ error: msg }, { status: 500 });
  }
}