// app/api/admin/global-search/route.ts
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

export async function GET(req: Request) {
  const auth = await requireManagerOrAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { searchParams } = new URL(req.url);

  const q = (searchParams.get("q") || "").trim();
  const start = searchParams.get("start"); // YYYY-MM-DD
  const end = searchParams.get("end"); // YYYY-MM-DD
  const showAll = searchParams.get("all") === "1";

  const limit = clamp(toInt(searchParams.get("limit"), 50), 5, 200);

  if (!q) {
    return NextResponse.json({
      q,
      start,
      end,
      all: showAll,
      sections: [
        { key: "daily", title: "Daily Production", count: 0, rows: [] },
        { key: "qc", title: "QC Daily Production", count: 0, rows: [] },
        { key: "emblem", title: "Emblem Production", count: 0, rows: [] },
        { key: "laser", title: "Laser Production", count: 0, rows: [] },
      ],
    });
  }

  const like = `%${q}%`;

  // Date filters: default last 30 days unless showAll or explicit start/end.
  // We apply per-module date field.
  const dateClause = (fieldSql: string) => {
    const parts: string[] = [];
    const params: any[] = [];

    if (!showAll) {
      if (start) {
        parts.push(`${fieldSql} >= $${params.length + 1}::date`);
        params.push(start);
      }
      if (end) {
        parts.push(`${fieldSql} <= $${params.length + 1}::date`);
        params.push(end);
      }
      if (!start && !end) {
        parts.push(`${fieldSql} >= (CURRENT_DATE - INTERVAL '30 days')`);
      }
    }

    return { sql: parts.length ? `AND ${parts.join(" AND ")}` : "", params };
  };

  // -------------------------
  // Daily Production (embroidery_daily_entries)
  // -------------------------
  const dailyDate = dateClause("e.shift_date");

  const dailySql = `
    SELECT
      e.id,
      e.entry_ts,
      e.shift_date AS entry_date,
      e.name,
      e.employee_number,
      e.shift,
      e.machine_number,
      e.sales_order,
      e.detail_number,
      e.embroidery_location,
      e.pieces,
      e.notes
    FROM embroidery_daily_entries e
    WHERE
      (
        e.name ILIKE $1
        OR e.shift ILIKE $2
        OR e.embroidery_location ILIKE $3
        OR COALESCE(e.notes, '') ILIKE $4
        OR CAST(e.employee_number AS text) ILIKE $5
        OR CAST(e.machine_number AS text) ILIKE $6
        OR CAST(e.sales_order AS text) ILIKE $7
        OR CAST(e.detail_number AS text) ILIKE $8
        OR CAST(e.shift_date AS text) ILIKE $9
      )
      ${dailyDate.sql}
    ORDER BY e.entry_ts DESC
    LIMIT $${9 + dailyDate.params.length + 1}
  `;

  const dailyParams = [
    like,
    like,
    like,
    like,
    like,
    like,
    like,
    like,
    like,
    ...dailyDate.params,
    limit,
  ];

  // -------------------------
  // QC Daily (qc_daily_entries)
  // -------------------------
  const qcDate = dateClause("q.entry_date");

  const qcSql = `
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
      q.notes
    FROM qc_daily_entries q
    WHERE
      (
        q.name ILIKE $1
        OR COALESCE(q.flat_or_3d, '') ILIKE $2
        OR COALESCE(q.notes, '') ILIKE $3
        OR CAST(q.employee_number AS text) ILIKE $4
        OR CAST(q.sales_order AS text) ILIKE $5
        OR CAST(q.detail_number AS text) ILIKE $6
        OR CAST(q.order_quantity AS text) ILIKE $7
        OR CAST(q.inspected_quantity AS text) ILIKE $8
        OR CAST(q.rejected_quantity AS text) ILIKE $9
        OR CAST(q.quantity_shipped AS text) ILIKE $10
        OR CAST(q.entry_date AS text) ILIKE $11
      )
      ${qcDate.sql}
    ORDER BY q.entry_ts DESC
    LIMIT $${11 + qcDate.params.length + 1}
  `;

  const qcParams = [
    like,
    like,
    like,
    like,
    like,
    like,
    like,
    like,
    like,
    like,
    like,
    ...qcDate.params,
    limit,
  ];

  // -------------------------
  // Emblem (lines + submissions)
  // -------------------------
  const emDate = dateClause("s.entry_date");

  const emblemSql = `
    SELECT
      s.id AS submission_id,
      s.entry_ts,
      s.entry_date,
      s.name,
      s.employee_number,
      l.sales_order,
      l.detail_number,
      l.emblem_type,
      l.logo_name,
      l.pieces,
      l.line_notes AS notes
    FROM emblem_daily_submission_lines l
    JOIN emblem_daily_submissions s ON s.id = l.submission_id
    WHERE
      (
        s.name ILIKE $1
        OR CAST(s.employee_number AS text) ILIKE $2
        OR CAST(s.entry_date AS text) ILIKE $3
        OR CAST(l.sales_order AS text) ILIKE $4
        OR CAST(l.detail_number AS text) ILIKE $5
        OR COALESCE(l.emblem_type, '') ILIKE $6
        OR COALESCE(l.logo_name, '') ILIKE $7
        OR CAST(l.pieces AS text) ILIKE $8
        OR COALESCE(l.line_notes, '') ILIKE $9
      )
      ${emDate.sql}
    ORDER BY s.entry_ts DESC
    LIMIT $${9 + emDate.params.length + 1}
  `;

  const emblemParams = [
    like,
    like,
    like,
    like,
    like,
    like,
    like,
    like,
    like,
    ...emDate.params,
    limit,
  ];

  // -------------------------
  // Laser (laser_entries)
  // -------------------------
  const lzDate = dateClause("l.entry_date");

  const laserSql = `
    SELECT
      l.id,
      l.entry_ts,
      l.entry_date,
      l.name,
      l.employee_number,
      l.sales_order,
      l.leather_style_color,
      l.pieces_cut,
      l.notes
    FROM laser_entries l
    WHERE
      (
        l.name ILIKE $1
        OR CAST(l.employee_number AS text) ILIKE $2
        OR CAST(l.entry_date AS text) ILIKE $3
        OR CAST(l.sales_order AS text) ILIKE $4
        OR COALESCE(l.leather_style_color, '') ILIKE $5
        OR CAST(l.pieces_cut AS text) ILIKE $6
        OR COALESCE(l.notes, '') ILIKE $7
      )
      ${lzDate.sql}
    ORDER BY l.entry_ts DESC
    LIMIT $${7 + lzDate.params.length + 1}
  `;

  const laserParams = [like, like, like, like, like, like, like, ...lzDate.params, limit];

  const [dailyRes, qcRes, emblemRes, laserRes] = await Promise.all([
    db.query(dailySql, dailyParams),
    db.query(qcSql, qcParams),
    db.query(emblemSql, emblemParams),
    db.query(laserSql, laserParams),
  ]);

  return NextResponse.json({
    q,
    start,
    end,
    all: showAll,
    limit,
    sections: [
      { key: "daily", title: "Daily Production", count: dailyRes.rows.length, rows: dailyRes.rows },
      { key: "qc", title: "QC Daily Production", count: qcRes.rows.length, rows: qcRes.rows },
      { key: "emblem", title: "Emblem Production", count: emblemRes.rows.length, rows: emblemRes.rows },
      { key: "laser", title: "Laser Production", count: laserRes.rows.length, rows: laserRes.rows },
    ],
  });
}