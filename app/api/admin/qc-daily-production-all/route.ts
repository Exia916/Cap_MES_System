// app/api/admin/qc-daily-production-all/route.ts
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
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { searchParams } = new URL(req.url);

  // Date filtering
  const start = searchParams.get("start"); // YYYY-MM-DD
  const end = searchParams.get("end"); // YYYY-MM-DD
  const showAll = searchParams.get("all") === "1";

  // ✅ NEW: Global search
  const q = (searchParams.get("q") || "").trim();

  // Filters
  const name = searchParams.get("name");
  const employeeNumber = searchParams.get("employee_number");
  const salesOrder = searchParams.get("sales_order");
  const detailNumber = searchParams.get("detail_number");
  const flatOr3d = searchParams.get("flat_or_3d"); // contains (or exact-ish)
  const orderQty = searchParams.get("order_quantity");
  const inspectedQty = searchParams.get("inspected_quantity");
  const rejectedQty = searchParams.get("rejected_quantity");
  const shippedQty = searchParams.get("quantity_shipped");
  const notes = searchParams.get("notes"); // contains

  const format = searchParams.get("format"); // "csv" | null

  // Paging / sorting
  const page = clamp(toInt(searchParams.get("page"), 1), 1, 1_000_000);
  const pageSize = clamp(toInt(searchParams.get("pageSize"), 100), 10, 500);

  const sortFieldRaw = (searchParams.get("sort") || "entry_ts").toLowerCase();
  const sortDirRaw = (searchParams.get("dir") || "desc").toLowerCase();

  // Allowlist sort fields
  const sortFieldMap: Record<string, string> = {
    entry_ts: "q.entry_ts",
    entry_date: "q.entry_date",
    name: "q.name",
    employee_number: "q.employee_number",
    sales_order: "q.sales_order",
    detail_number: "q.detail_number",
    flat_or_3d: "q.flat_or_3d",
    order_quantity: "q.order_quantity",
    inspected_quantity: "q.inspected_quantity",
    rejected_quantity: "q.rejected_quantity",
    quantity_shipped: "q.quantity_shipped",

    // derived (window)
    total_qty_inspected_by_date: "total_qty_inspected_by_date",
    flat_totals: "flat_totals",
    three_d_totals: "three_d_totals",
    flat_totals_by_person: "flat_totals_by_person",
    three_d_totals_by_person: "three_d_totals_by_person",
    total_qty_inspected_by_person: "total_qty_inspected_by_person",
  };

  const sortField = sortFieldMap[sortFieldRaw] || "q.entry_ts";
  const sortDir = sortDirRaw === "asc" ? "ASC" : "DESC";

  const where: string[] = [];
  const params: any[] = [];

  const add = (sql: string, value?: any) => {
    where.push(sql.replace("?", `$${params.length + 1}`));
    params.push(value);
  };

  // ✅ Default to last 30 days (by entry_date) unless showAll
  if (!showAll) {
    if (start) add(`q.entry_date >= ?::date`, start);
    if (end) add(`q.entry_date <= ?::date`, end);
    if (!start && !end) {
      where.push(`q.entry_date >= (CURRENT_DATE - INTERVAL '30 days')`);
    }
  }

  // ✅ NEW: Global search across common fields (incl qty fields)
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
      q.name ILIKE ${p1}
      OR COALESCE(q.flat_or_3d, '') ILIKE ${p2}
      OR COALESCE(q.notes, '') ILIKE ${p3}
      OR CAST(q.employee_number AS text) ILIKE ${p4}
      OR CAST(q.sales_order AS text) ILIKE ${p5}
      OR CAST(q.detail_number AS text) ILIKE ${p6}
      OR CAST(q.order_quantity AS text) ILIKE ${p7}
      OR CAST(q.inspected_quantity AS text) ILIKE ${p8}
      OR CAST(q.rejected_quantity AS text) ILIKE ${p9}
      OR CAST(q.quantity_shipped AS text) ILIKE $${params.length + 10}
    )`);

    params.push(like, like, like, like, like, like, like, like, like, like);
  }

  if (name) add(`q.name ILIKE ?`, `%${name}%`);
  if (employeeNumber) add(`CAST(q.employee_number AS text) ILIKE ?`, `%${employeeNumber}%`);
  if (salesOrder) add(`CAST(q.sales_order AS text) ILIKE ?`, `%${salesOrder}%`);
  if (detailNumber) add(`CAST(q.detail_number AS text) ILIKE ?`, `%${detailNumber}%`);
  if (flatOr3d) add(`COALESCE(q.flat_or_3d, '') ILIKE ?`, `%${flatOr3d}%`);

  if (orderQty) add(`CAST(q.order_quantity AS text) ILIKE ?`, `%${orderQty}%`);
  if (inspectedQty) add(`CAST(q.inspected_quantity AS text) ILIKE ?`, `%${inspectedQty}%`);
  if (rejectedQty) add(`CAST(q.rejected_quantity AS text) ILIKE ?`, `%${rejectedQty}%`);
  if (shippedQty) add(`CAST(q.quantity_shipped AS text) ILIKE ?`, `%${shippedQty}%`);

  if (notes) add(`COALESCE(q.notes, '') ILIKE ?`, `%${notes}%`);

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const baseSelect = `
    SELECT
      q.id,
      q.entry_ts,
      q.entry_date,
      q.name,
      q.employee_number,
      q.sales_order,
      q.detail_number,
      q.flat_or_3d,
      q.order_quantity,
      q.inspected_quantity,
      q.rejected_quantity,
      q.quantity_shipped,
      q.notes,

      COALESCE(SUM(q.inspected_quantity) OVER (PARTITION BY q.entry_date), 0)::bigint AS total_qty_inspected_by_date,
      COALESCE(SUM(CASE WHEN LOWER(COALESCE(q.flat_or_3d,'')) = 'flat' THEN q.inspected_quantity ELSE 0 END)
        OVER (PARTITION BY q.entry_date), 0)::bigint AS flat_totals,
      COALESCE(SUM(CASE WHEN LOWER(COALESCE(q.flat_or_3d,'')) = '3d' THEN q.inspected_quantity ELSE 0 END)
        OVER (PARTITION BY q.entry_date), 0)::bigint AS three_d_totals,

      COALESCE(SUM(CASE WHEN LOWER(COALESCE(q.flat_or_3d,'')) = 'flat' THEN q.inspected_quantity ELSE 0 END)
        OVER (PARTITION BY q.entry_date, q.name), 0)::bigint AS flat_totals_by_person,
      COALESCE(SUM(CASE WHEN LOWER(COALESCE(q.flat_or_3d,'')) = '3d' THEN q.inspected_quantity ELSE 0 END)
        OVER (PARTITION BY q.entry_date, q.name), 0)::bigint AS three_d_totals_by_person,

      COALESCE(SUM(q.inspected_quantity) OVER (PARTITION BY q.entry_date, q.name), 0)::bigint AS total_qty_inspected_by_person

    FROM qc_daily_entries q
    ${whereSql}
    ORDER BY ${sortField} ${sortDir}
  `;

  // CSV export (no paging)
  if (format === "csv") {
    const { rows } = await db.query(baseSelect, params);

    const headers = [
      "entry_ts",
      "name",
      "sales_order",
      "detail_number",
      "flat_or_3d",
      "order_quantity",
      "inspected_quantity",
      "rejected_quantity",
      "quantity_shipped",
      "notes",
      "entry_date",
      "total_qty_inspected_by_date",
      "flat_totals",
      "three_d_totals",
      "flat_totals_by_person",
      "three_d_totals_by_person",
      "total_qty_inspected_by_person",
      "employee_number",
    ];

    const lines = [headers.join(","), ...rows.map((r: any) => headers.map((h) => escCsv(r[h])).join(","))];

    return new NextResponse(lines.join("\n"), {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="qc-daily-production-all.csv"`,
        "Cache-Control": "no-store",
      },
    });
  }

  // Count + paged rows + totals
  const countSql = `SELECT COUNT(*)::int AS count FROM qc_daily_entries q ${whereSql}`;
  const offset = (page - 1) * pageSize;
  const pagedSql = `${baseSelect} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  const pagedParams = [...params, pageSize, offset];

  const totalsSql = `
    SELECT
      COALESCE(SUM(q.inspected_quantity), 0)::bigint AS total_inspected_quantity,
      COALESCE(SUM(q.rejected_quantity), 0)::bigint AS total_rejected_quantity,
      COALESCE(SUM(q.quantity_shipped), 0)::bigint AS total_quantity_shipped
    FROM qc_daily_entries q
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
    totals: totalsRes.rows?.[0] ?? {
      total_inspected_quantity: 0,
      total_rejected_quantity: 0,
      total_quantity_shipped: 0,
    },
  });
}