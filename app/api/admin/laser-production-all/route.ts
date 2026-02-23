// app/api/admin/laser-production-all/route.ts
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

  // Filters
  const name = searchParams.get("name");
  const employeeNumber = searchParams.get("employee_number");
  const salesOrder = searchParams.get("sales_order");
  const leather = searchParams.get("leather_style_color");
  const piecesCut = searchParams.get("pieces_cut");
  const notes = searchParams.get("notes");

  // Paging / sorting
  const page = clamp(toInt(searchParams.get("page"), 1), 1, 1_000_000);
  const pageSize = clamp(toInt(searchParams.get("pageSize"), 50), 10, 500);

  const sortFieldRaw = (searchParams.get("sort") || "entry_ts").toLowerCase();
  const sortDirRaw = (searchParams.get("dir") || "desc").toLowerCase();
  const sortDir = sortDirRaw === "asc" ? "ASC" : "DESC";

  const format = searchParams.get("format"); // "csv" | null

  // Allowlist sort fields
  const sortFieldMap: Record<string, string> = {
    entry_ts: "l.entry_ts",
    entry_date: "l.entry_date",
    name: "l.name",
    employee_number: "l.employee_number",

    sales_order: "l.sales_order",
    leather_style_color: "l.leather_style_color",
    pieces_cut: "l.pieces_cut",
    notes: "l.notes",

    total_pieces_per_day: "total_pieces_per_day",
  };

  const sortField = sortFieldMap[sortFieldRaw] || "l.entry_ts";

  // WHERE builder
  const where: string[] = [];
  const params: any[] = [];

  const add = (sql: string, value?: any) => {
    where.push(sql.replace("?", `$${params.length + 1}`));
    params.push(value);
  };

  // ✅ Default to last 30 days unless showAll
  if (!showAll) {
    if (start) add(`l.entry_date >= ?::date`, start);
    if (end) add(`l.entry_date <= ?::date`, end);
    if (!start && !end) where.push(`l.entry_date >= (CURRENT_DATE - INTERVAL '30 days')`);
  }

  if (name) add(`l.name ILIKE ?`, `%${name}%`);
  if (employeeNumber) add(`CAST(l.employee_number AS text) ILIKE ?`, `%${employeeNumber}%`);
  if (salesOrder) add(`CAST(l.sales_order AS text) ILIKE ?`, `%${salesOrder}%`);
  if (leather) add(`COALESCE(l.leather_style_color, '') ILIKE ?`, `%${leather}%`);
  if (piecesCut) add(`CAST(l.pieces_cut AS text) ILIKE ?`, `%${piecesCut}%`);
  if (notes) add(`COALESCE(l.notes, '') ILIKE ?`, `%${notes}%`);

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  // Total Pieces Per Day (by entry_date)
  const baseSelect = `
    SELECT
      l.id,
      l.entry_ts,
      l.entry_date,
      l.name,
      l.employee_number,
      l.sales_order,
      l.leather_style_color,
      l.pieces_cut,
      l.notes,
      COALESCE(SUM(l.pieces_cut) OVER (PARTITION BY l.entry_date), 0)::bigint AS total_pieces_per_day
    FROM laser_entries l
    ${whereSql}
    ORDER BY ${sortField} ${sortDir}
  `;

  // CSV export (no paging)
  if (format === "csv") {
    const { rows } = await db.query(baseSelect, params);

    const headers = [
      "entry_ts",
      "entry_date",
      "name",
      "employee_number",
      "sales_order",
      "leather_style_color",
      "pieces_cut",
      "notes",
      "total_pieces_per_day",
    ];

    const lines = [
      headers.join(","),
      ...rows.map((r: any) => headers.map((h) => escCsv(r[h])).join(",")),
    ];

    return new NextResponse(lines.join("\n"), {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="laser-production-all.csv"`,
        "Cache-Control": "no-store",
      },
    });
  }

  // Count + paged
  const countSql = `
    SELECT COUNT(*)::int AS count
    FROM laser_entries l
    ${whereSql}
  `;

  const offset = (page - 1) * pageSize;
  const pagedSql = `${baseSelect} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  const pagedParams = [...params, pageSize, offset];

  // Top metrics
  const totalsSql = `
    SELECT COALESCE(SUM(l.pieces_cut), 0)::bigint AS total_pieces_cut
    FROM laser_entries l
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
    totals: totalsRes.rows?.[0] ?? { total_pieces_cut: 0 },
  });
}