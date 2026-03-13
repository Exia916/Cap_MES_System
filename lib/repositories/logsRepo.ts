import { db } from "@/lib/db";

export type LogSortDir = "asc" | "desc";

export type AppLogRow = {
  id: string;
  created_at: string;
  level: string;
  category: string;
  event_type: string | null;
  message: string | null;
  module: string | null;
  route: string | null;
  method: string | null;
  username: string | null;
  employee_number: number | null;
  role: string | null;
  record_type: string | null;
  record_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  details_json: any;
};

export type ListAppLogsParams = {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDir?: LogSortDir;
  filters?: Record<string, string | undefined>;
};

function clampInt(v: unknown, fallback: number, min: number, max: number) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

function safeSortBy(v: string | undefined) {
  const allowed = new Set([
    "created_at",
    "level",
    "category",
    "event_type",
    "module",
    "username",
    "route",
  ]);
  return allowed.has(String(v || "")) ? String(v) : "created_at";
}

function safeSortDir(v: string | undefined): LogSortDir {
  return String(v || "").toLowerCase() === "asc" ? "asc" : "desc";
}

export async function listAppLogsPaged(params: ListAppLogsParams) {
  const page = clampInt(params.page ?? 1, 1, 1, 100000);
  const pageSize = clampInt(params.pageSize ?? 25, 25, 1, 200);
  const offset = (page - 1) * pageSize;

  const sortBy = safeSortBy(params.sortBy);
  const sortDir = safeSortDir(params.sortDir);

  const filters = params.filters || {};

  const values: any[] = [];
  const where: string[] = [];

  function addLike(column: string, value?: string) {
    const v = String(value || "").trim();
    if (!v) return;
    values.push(`%${v}%`);
    where.push(`${column} ILIKE $${values.length}`);
  }

  addLike("level", filters.level);
  addLike("category", filters.category);
  addLike("event_type", filters.event_type);
  addLike("module", filters.module);
  addLike("username", filters.username);
  addLike("route", filters.route);
  addLike("message", filters.message);

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const countSql = `
    SELECT COUNT(*)::int AS total
    FROM app_logs
    ${whereSql}
  `;

  const dataSql = `
    SELECT
      id::text,
      created_at,
      level,
      category,
      event_type,
      message,
      module,
      route,
      method,
      username,
      employee_number,
      role,
      record_type,
      record_id,
      ip_address,
      user_agent,
      details_json
    FROM app_logs
    ${whereSql}
    ORDER BY ${sortBy} ${sortDir}, id DESC
    LIMIT $${values.length + 1}
    OFFSET $${values.length + 2}
  `;

  const countRes = await db.query(countSql, values);
  const total = Number(countRes.rows[0]?.total || 0);

  const dataRes = await db.query(dataSql, [...values, pageSize, offset]);

  return {
    rows: dataRes.rows as AppLogRow[],
    total,
    page,
    pageSize,
  };
}