import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyJwt } from "@/lib/auth";
import { db } from "@/lib/db";

type Resp =
  | { entries: any[]; totalCount: number; limit: number; offset: number }
  | { error: string };

function isValidDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function clampInt(value: string | null, def: number, min: number, max: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return def;
  const i = Math.trunc(n);
  return Math.max(min, Math.min(max, i));
}

function ymdChicago(d: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);

  const yyyy = parts.find((p) => p.type === "year")?.value ?? "1970";
  const mm = parts.find((p) => p.type === "month")?.value ?? "01";
  const dd = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${yyyy}-${mm}-${dd}`;
}

const ALLOWED_SORT = new Set(["entryTs", "entryDate", "name", "salesOrder", "leatherStyleColor", "piecesCut"]);

export async function GET(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;
    if (!token) return NextResponse.json<Resp>({ error: "Unauthorized" }, { status: 401 });

    const payload = verifyJwt(token);
    if (!payload) return NextResponse.json<Resp>({ error: "Unauthorized" }, { status: 401 });

    const sp = req.nextUrl.searchParams;

    // ----- Date range default last 30 days
    const rawFrom = sp.get("entryDateFrom")?.trim() ?? "";
    const rawTo = sp.get("entryDateTo")?.trim() ?? "";

    const today = ymdChicago(new Date());
    const d = new Date();
    d.setDate(d.getDate() - 29);
    const defaultFrom = ymdChicago(d);

    const entryDateFrom = rawFrom || defaultFrom;
    const entryDateTo = rawTo || today;

    if (!isValidDate(entryDateFrom) || !isValidDate(entryDateTo)) {
      return NextResponse.json<Resp>({ error: "Missing or invalid entryDateFrom/entryDateTo (expected YYYY-MM-DD)" }, { status: 400 });
    }

    // ----- Paging
    const limit = clampInt(sp.get("limit"), 25, 1, 200);
    const offset = clampInt(sp.get("offset"), 0, 0, 1_000_000);

    // ----- Sort
    const sortByRaw = sp.get("sortBy")?.trim() || "entryTs";
    const sortBy = (ALLOWED_SORT.has(sortByRaw) ? sortByRaw : "entryTs") as
      | "entryTs"
      | "entryDate"
      | "name"
      | "salesOrder"
      | "leatherStyleColor"
      | "piecesCut";

    const sortDir = (sp.get("sortDir")?.trim() || "desc").toLowerCase() === "asc" ? "ASC" : "DESC";

    // ----- Filters
    const name = sp.get("name")?.trim() ?? "";
    const notes = sp.get("notes")?.trim() ?? "";
    const salesOrderStartsWith = sp.get("salesOrder")?.trim() ?? "";
    const leatherStyleColor = sp.get("leatherStyleColor")?.trim() ?? "";

    const params: any[] = [entryDateFrom, entryDateTo];
    let where = `l.entry_date BETWEEN $1::date AND $2::date`;

    // Non-admin restriction: only your own entries
    if (payload.role !== "ADMIN") {
      if (payload.employeeNumber) {
        params.push(Number(payload.employeeNumber));
        where += ` AND l.employee_number = $${params.length}::int`;
      } else {
        params.push(payload.displayName ?? payload.username ?? "");
        where += ` AND l.name = $${params.length}::text`;
      }
    }

    if (name) {
      params.push(`%${name}%`);
      where += ` AND l.name ILIKE $${params.length}`;
    }

    if (salesOrderStartsWith) {
      params.push(`${salesOrderStartsWith}%`);
      where += ` AND COALESCE(l.sales_order::text,'') LIKE $${params.length}`;
    }

    if (leatherStyleColor) {
      params.push(`%${leatherStyleColor}%`);
      where += ` AND COALESCE(l.leather_style_color,'') ILIKE $${params.length}`;
    }

    if (notes) {
      params.push(`%${notes}%`);
      where += ` AND COALESCE(l.notes,'') ILIKE $${params.length}`;
    }

    const ORDER_MAP: Record<string, string> = {
      entryTs: `l.entry_ts`,
      entryDate: `l.entry_date`,
      name: `l.name`,
      salesOrder: `l.sales_order`,
      leatherStyleColor: `l.leather_style_color`,
      piecesCut: `l.pieces_cut`,
    };

    const orderExpr = ORDER_MAP[sortBy] ?? ORDER_MAP.entryTs;
    const orderBySql = `${orderExpr} ${sortDir}, l.id DESC`;

    // count query
    const countRes = await db.query<{ total: number }>(
      `
      SELECT COUNT(*)::int AS total
      FROM public.laser_entries l
      WHERE ${where}
      `,
      params
    );
    const totalCount = countRes.rows[0]?.total ?? 0;

    // page query
    params.push(limit);
    const limitParam = `$${params.length}`;
    params.push(offset);
    const offsetParam = `$${params.length}`;

    const { rows } = await db.query(
      `
      SELECT
        l.id,
        l.entry_ts AS "entryTs",
        l.entry_date AS "entryDate",
        l.name,
        l.employee_number AS "employeeNumber",
        l.sales_order::text AS "salesOrder",
        l.leather_style_color AS "leatherStyleColor",
        l.pieces_cut AS "piecesCut",
        l.notes
      FROM public.laser_entries l
      WHERE ${where}
      ORDER BY ${orderBySql}
      LIMIT ${limitParam}
      OFFSET ${offsetParam}
      `,
      params
    );

    return NextResponse.json<Resp>(
      { entries: rows, totalCount, limit, offset },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("laser-production-list GET error:", err);
    return NextResponse.json<Resp>({ error: err?.message || "Server error" }, { status: 500 });
  }
}
