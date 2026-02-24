// app/api/admin/emblem-production-all/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireManagerOrAdmin } from "../_shared/adminAuth";

export const runtime = "nodejs";

function toInt(v: string | null, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}
function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}
function escCsv(val: any) {
  const s = val === null || val === undefined ? "" : String(val);
  if (/[,"\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET(req: Request) {
  const auth = await requireManagerOrAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { searchParams } = new URL(req.url);

  // Dates
  const start = searchParams.get("start"); // YYYY-MM-DD
  const end = searchParams.get("end"); // YYYY-MM-DD
  const showAll = searchParams.get("all") === "1";

  // ✅ NEW: global search
  const q = (searchParams.get("q") || "").trim();

  // Filters
  const name = searchParams.get("name");
  const employeeNumber = searchParams.get("employee_number");
  const salesOrder = searchParams.get("sales_order");
  const detailNumber = searchParams.get("detail_number");
  const emblemType = searchParams.get("emblem_type"); // contains / exact-ish
  const logoName = searchParams.get("logo_name"); // contains
  const pieces = searchParams.get("pieces"); // contains numeric as text
  const notes = searchParams.get("notes"); // contains (line_notes)

  // Paging / sorting
  const page = clamp(toInt(searchParams.get("page"), 1), 1, 1_000_000);
  const pageSize = clamp(toInt(searchParams.get("pageSize"), 50), 10, 500);

  const sortFieldRaw = (searchParams.get("sort") || "entry_ts").toLowerCase();
  const sortDirRaw = (searchParams.get("dir") || "desc").toLowerCase();
  const sortDir = sortDirRaw === "asc" ? "ASC" : "DESC";

  const format = searchParams.get("format"); // "csv" | null

  // Allowlist sort fields
  const sortFieldMap: Record<string, string> = {
    entry_ts: "s.entry_ts",
    entry_date: "s.entry_date",
    name: "s.name",
    employee_number: "s.employee_number",

    sales_order: "l.sales_order",
    detail_number: "l.detail_number",
    emblem_type: "l.emblem_type",
    logo_name: "l.logo_name",
    pieces: "l.pieces",

    // derived
    total_pieces: "total_pieces",
    sew: "sew",
    sticker: "sticker",
    heat_seal: "heat_seal",
    total_pieces_by_person: "total_pieces_by_person",
    total_sew_by_person: "total_sew_by_person",
    total_sticker_by_person: "total_sticker_by_person",
    total_heat_seal_by_person: "total_heat_seal_by_person",
  };

  const sortField = sortFieldMap[sortFieldRaw] || "s.entry_ts";

  // WHERE builder
  const where: string[] = [];
  const params: any[] = [];

  const add = (sql: string, value?: any) => {
    where.push(sql.replace("?", `$${params.length + 1}`));
    params.push(value);
  };

  // ✅ Default to last 30 days unless showAll
  if (!showAll) {
    if (start) add(`s.entry_date >= ?::date`, start);
    if (end) add(`s.entry_date <= ?::date`, end);
    if (!start && !end) where.push(`s.entry_date >= (CURRENT_DATE - INTERVAL '30 days')`);
  }

  // ✅ NEW: Global search across common fields
  // Includes date-as-text so typing 2026-02-20 will match entry_date too.
  if (q) {
    const like = `%${q}%`;

    const p1 = `$${params.length + 1}`;
    const p2 = `$${params.length + 2}`;
    const p3 = `$${params.length + 3}`;
    const p4 = `$${params.length + 4}`;
    const p5 = `$${params.length + 5}`;
    const p6 = `$${params.length + 6}`;
    const p7 = `$${params.length + 7}`;
    const p8 = `$${params.length + 8}`;
    const p9 = `$${params.length + 9}`;

    where.push(`(
      s.name ILIKE ${p1}
      OR CAST(s.employee_number AS text) ILIKE ${p2}
      OR CAST(s.entry_date AS text) ILIKE ${p3}

      OR CAST(l.sales_order AS text) ILIKE ${p4}
      OR CAST(l.detail_number AS text) ILIKE ${p5}
      OR COALESCE(l.emblem_type, '') ILIKE ${p6}
      OR COALESCE(l.logo_name, '') ILIKE ${p7}
      OR CAST(l.pieces AS text) ILIKE ${p8}
      OR COALESCE(l.line_notes, '') ILIKE ${p9}
    )`);

    params.push(like, like, like, like, like, like, like, like, like);
  }

  if (name) add(`s.name ILIKE ?`, `%${name}%`);
  if (employeeNumber) add(`CAST(s.employee_number AS text) ILIKE ?`, `%${employeeNumber}%`);

  if (salesOrder) add(`CAST(l.sales_order AS text) ILIKE ?`, `%${salesOrder}%`);
  if (detailNumber) add(`CAST(l.detail_number AS text) ILIKE ?`, `%${detailNumber}%`);
  if (emblemType) add(`COALESCE(l.emblem_type, '') ILIKE ?`, `%${emblemType}%`);
  if (logoName) add(`COALESCE(l.logo_name, '') ILIKE ?`, `%${logoName}%`);
  if (pieces) add(`CAST(l.pieces AS text) ILIKE ?`, `%${pieces}%`);
  if (notes) add(`COALESCE(l.line_notes, '') ILIKE ?`, `%${notes}%`);

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  // Window calcs per your spec (by Date; and by Date+Name)
  const baseSelect = `
    SELECT
      s.entry_ts,
      s.entry_date,
      s.name,
      s.employee_number,

      l.sales_order,
      l.detail_number,
      l.emblem_type,
      l.logo_name,
      l.pieces,
      l.line_notes AS notes,

      -- totals by date
      COALESCE(SUM(l.pieces) OVER (PARTITION BY s.entry_date), 0)::bigint AS total_pieces,
      COALESCE(SUM(CASE WHEN LOWER(COALESCE(l.emblem_type,'')) = 'sew' THEN l.pieces ELSE 0 END)
        OVER (PARTITION BY s.entry_date), 0)::bigint AS sew,
      COALESCE(SUM(CASE WHEN LOWER(COALESCE(l.emblem_type,'')) = 'sticker' THEN l.pieces ELSE 0 END)
        OVER (PARTITION BY s.entry_date), 0)::bigint AS sticker,
      COALESCE(SUM(CASE WHEN LOWER(COALESCE(l.emblem_type,'')) IN ('heat seal','heatseal','heat_seal') THEN l.pieces ELSE 0 END)
        OVER (PARTITION BY s.entry_date), 0)::bigint AS heat_seal,

      -- totals by date + person
      COALESCE(SUM(l.pieces) OVER (PARTITION BY s.entry_date, s.name), 0)::bigint AS total_pieces_by_person,
      COALESCE(SUM(CASE WHEN LOWER(COALESCE(l.emblem_type,'')) = 'sew' THEN l.pieces ELSE 0 END)
        OVER (PARTITION BY s.entry_date, s.name), 0)::bigint AS total_sew_by_person,
      COALESCE(SUM(CASE WHEN LOWER(COALESCE(l.emblem_type,'')) = 'sticker' THEN l.pieces ELSE 0 END)
        OVER (PARTITION BY s.entry_date, s.name), 0)::bigint AS total_sticker_by_person,
      COALESCE(SUM(CASE WHEN LOWER(COALESCE(l.emblem_type,'')) IN ('heat seal','heatseal','heat_seal') THEN l.pieces ELSE 0 END)
        OVER (PARTITION BY s.entry_date, s.name), 0)::bigint AS total_heat_seal_by_person

    FROM emblem_daily_submission_lines l
    JOIN emblem_daily_submissions s ON s.id = l.submission_id
    ${whereSql}
    ORDER BY ${sortField} ${sortDir}
  `;

  // CSV export (no paging)
  if (format === "csv") {
    const { rows } = await db.query(baseSelect, params);

    const headers = [
      "entry_ts",
      "name",
      "employee_number",
      "sales_order",
      "detail_number",
      "emblem_type",
      "logo_name",
      "pieces",
      "notes",
      "entry_date",
      "total_pieces",
      "sew",
      "sticker",
      "heat_seal",
      "total_pieces_by_person",
      "total_sew_by_person",
      "total_sticker_by_person",
      "total_heat_seal_by_person",
    ];

    const lines = [headers.join(","), ...rows.map((r: any) => headers.map((h) => escCsv(r[h])).join(","))];

    return new NextResponse(lines.join("\n"), {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="emblem-production-all.csv"`,
        "Cache-Control": "no-store",
      },
    });
  }

  // Count + paged
  const countSql = `
    SELECT COUNT(*)::int AS count
    FROM emblem_daily_submission_lines l
    JOIN emblem_daily_submissions s ON s.id = l.submission_id
    ${whereSql}
  `;

  const offset = (page - 1) * pageSize;
  const pagedSql = `${baseSelect} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  const pagedParams = [...params, pageSize, offset];

  // Top metrics
  const totalsSql = `
    SELECT
      COALESCE(SUM(l.pieces), 0)::bigint AS total_pieces
    FROM emblem_daily_submission_lines l
    JOIN emblem_daily_submissions s ON s.id = l.submission_id
    ${whereSql}
  `;

  const [countRes, rowsRes, totalsRes] = await Promise.all([
    db.query(countSql, params),
    db.query(pagedSql, pagedParams),
    db.query(totalsSql, params),
  ]);

  const totalCount = countRes.rows?.[0]?.count ?? 0;

  return NextResponse.json({
    page,
    pageSize,
    totalCount,
    totalPages: Math.ceil(totalCount / pageSize),
    rows: rowsRes.rows,
    totals: totalsRes.rows?.[0] ?? { total_pieces: 0 },
  });
}