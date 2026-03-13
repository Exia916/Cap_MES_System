"use client";

import { useEffect, useMemo, useState } from "react";
import DataTable, { type Column, type SortDir } from "@/components/DataTable";

type LogRow = {
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

type ApiResp = {
  rows: LogRow[];
  total: number;
  page: number;
  pageSize: number;
  error?: string;
};

function fmtDate(v: string | null | undefined) {
  if (!v) return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleString();
}

function levelBadge(level: string) {
  const v = String(level || "").toUpperCase();
  const style: React.CSSProperties = {
    display: "inline-block",
    minWidth: 72,
    padding: "4px 8px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700,
    textAlign: "center",
    border: "1px solid #d1d5db",
    background: "#f3f4f6",
  };

  if (v === "ERROR") {
    style.background = "#fee2e2";
    style.border = "1px solid #fecaca";
  } else if (v === "WARN") {
    style.background = "#fef3c7";
    style.border = "1px solid #fde68a";
  } else if (v === "SECURITY") {
    style.background = "#ede9fe";
    style.border = "1px solid #ddd6fe";
  } else if (v === "AUDIT") {
    style.background = "#dbeafe";
    style.border = "1px solid #bfdbfe";
  } else if (v === "INFO") {
    style.background = "#dcfce7";
    style.border = "1px solid #bbf7d0";
  }

  return <span style={style}>{v || "-"}</span>;
}

export default function AdminLogsPage() {
  const [rows, setRows] = useState<LogRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(25);

  const [sortBy, setSortBy] = useState("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const [filters, setFilters] = useState<Record<string, string>>({
    level: "",
    category: "",
    event_type: "",
    module: "",
    username: "",
    route: "",
    message: "",
  });

  const [selected, setSelected] = useState<LogRow | null>(null);

  useEffect(() => {
    let ignore = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        params.set("page", String(pageIndex + 1));
        params.set("pageSize", String(pageSize));
        params.set("sortBy", sortBy);
        params.set("sortDir", sortDir);

        Object.entries(filters).forEach(([k, v]) => {
          if (String(v || "").trim()) params.set(k, v.trim());
        });

        const res = await fetch(`/api/admin/logs?${params.toString()}`, {
          cache: "no-store",
        });

        const data: ApiResp = await res.json();

        if (!res.ok) {
          throw new Error(data?.error || "Failed to load logs");
        }

        if (!ignore) {
          setRows(Array.isArray(data.rows) ? data.rows : []);
          setTotal(Number(data.total || 0));
        }
      } catch (err) {
        if (!ignore) {
          setRows([]);
          setTotal(0);
          setError(err instanceof Error ? err.message : "Failed to load logs");
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    load();
    return () => {
      ignore = true;
    };
  }, [pageIndex, pageSize, sortBy, sortDir, filters]);

  function onToggleSort(key: string) {
    if (sortBy === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(key);
      setSortDir(key === "created_at" ? "desc" : "asc");
    }
    setPageIndex(0);
  }

  function onFilterChange(key: string, value: string) {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPageIndex(0);
  }

  const columns = useMemo<Column<LogRow>[]>(() => {
    return [
      {
        key: "created_at",
        header: "Created",
        sortable: true,
        filterable: false,
        width: 180,
        getSearchText: (r) => fmtDate(r.created_at),
        render: (r) => <span>{fmtDate(r.created_at)}</span>,
      },
      {
        key: "level",
        header: "Level",
        sortable: true,
        filterable: true,
        width: 100,
        render: (r) => levelBadge(r.level),
      },
      {
        key: "category",
        header: "Category",
        sortable: true,
        filterable: true,
        width: 110,
        render: (r) => r.category || "-",
      },
      {
        key: "event_type",
        header: "Event",
        sortable: true,
        filterable: true,
        width: 180,
        render: (r) => r.event_type || "-",
      },
      {
        key: "module",
        header: "Module",
        sortable: true,
        filterable: true,
        width: 110,
        render: (r) => r.module || "-",
      },
      {
        key: "username",
        header: "User",
        sortable: true,
        filterable: true,
        width: 120,
        render: (r) => r.username || "-",
      },
      {
        key: "route",
        header: "Route",
        sortable: true,
        filterable: true,
        width: 200,
        render: (r) => (
          <div>
            <div>{r.route || "-"}</div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>{r.method || ""}</div>
          </div>
        ),
      },
      {
        key: "message",
        header: "Message",
        sortable: false,
        serverSortable: false,
        filterable: true,
        width: 320,
        getSearchText: (r) => r.message || "",
        render: (r) => (
          <div style={{ whiteSpace: "normal", lineHeight: 1.3 }}>
            {r.message || "-"}
          </div>
        ),
      },
      {
        key: "details",
        header: "Details",
        sortable: false,
        serverSortable: false,
        filterable: false,
        width: 110,
        getSearchText: (r) =>
          JSON.stringify(r.details_json || {}) +
          " " +
          String(r.record_type || "") +
          " " +
          String(r.record_id || ""),
        render: (r) => (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setSelected((prev) => (prev?.id === r.id ? null : r))}
          >
            {selected?.id === r.id ? "Close" : "View"}
          </button>
        ),
      },
    ];
  }, [selected]);

  const toolbar = (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      <button
        type="button"
        className="btn btn-secondary"
        onClick={() => {
          setFilters({
            level: "",
            category: "",
            event_type: "",
            module: "",
            username: "",
            route: "",
            message: "",
          });
          setPageIndex(0);
        }}
      >
        Clear Filters
      </button>

      <button
        type="button"
        className="btn btn-secondary"
        onClick={() => {
          setSortBy("created_at");
          setSortDir("desc");
          setPageIndex(0);
        }}
      >
        Newest First
      </button>
    </div>
  );

  return (
    <div style={{ padding: 16 }}>
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1 style={{ margin: 0 }}>Application Logs</h1>
          <p style={{ margin: "8px 0 0 0", opacity: 0.8 }}>
            Review authentication, API, security, and audit log entries.
          </p>
        </div>
      </div>

      <DataTable<LogRow>
        columns={columns}
        rows={rows}
        loading={loading}
        error={error}
        sortBy={sortBy}
        sortDir={sortDir}
        onToggleSort={onToggleSort}
        filters={filters}
        onFilterChange={onFilterChange}
        totalCount={total}
        pageIndex={pageIndex}
        pageSize={pageSize}
        onPageIndexChange={setPageIndex}
        onPageSizeChange={(next) => {
          setPageSize(next);
          setPageIndex(0);
        }}
        toolbar={toolbar}
        rowKey={(r) => r.id}
        emptyText="No log entries found."
        csvFilename="application-logs.csv"
        rowToCsv={(r) => ({
          id: r.id,
          created_at: r.created_at,
          level: r.level,
          category: r.category,
          event_type: r.event_type || "",
          module: r.module || "",
          username: r.username || "",
          route: r.route || "",
          method: r.method || "",
          message: r.message || "",
          record_type: r.record_type || "",
          record_id: r.record_id || "",
          ip_address: r.ip_address || "",
          user_agent: r.user_agent || "",
          details_json: JSON.stringify(r.details_json || {}),
        })}
        renderExpandedRow={(r) => {
          if (!selected || selected.id !== r.id) return null;
          return (
            <div
              style={{
                border: "1px solid #d1d5db",
                borderRadius: 12,
                padding: 16,
                background: "#fff",
                margin: "4px 0",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  alignItems: "center",
                  marginBottom: 12,
                }}
              >
                <h2 style={{ margin: 0 }}>Log Details</h2>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: 8 }}>
                <strong>ID</strong><div>{selected.id}</div>
                <strong>Created</strong><div>{fmtDate(selected.created_at)}</div>
                <strong>Level</strong><div>{selected.level}</div>
                <strong>Category</strong><div>{selected.category}</div>
                <strong>Event</strong><div>{selected.event_type || "-"}</div>
                <strong>Module</strong><div>{selected.module || "-"}</div>
                <strong>User</strong><div>{selected.username || "-"}</div>
                <strong>Role</strong><div>{selected.role || "-"}</div>
                <strong>Route</strong><div>{selected.route || "-"}</div>
                <strong>Method</strong><div>{selected.method || "-"}</div>
                <strong>Record</strong>
                <div>
                  {selected.record_type || "-"}
                  {selected.record_id ? ` / ${selected.record_id}` : ""}
                </div>
                <strong>IP</strong><div>{selected.ip_address || "-"}</div>
                <strong>User Agent</strong>
                <div style={{ wordBreak: "break-word" }}>{selected.user_agent || "-"}</div>
                <strong>Message</strong>
                <div style={{ whiteSpace: "pre-wrap" }}>{selected.message || "-"}</div>
                <strong>Details JSON</strong>
                <pre
                  style={{
                    margin: 0,
                    padding: 12,
                    background: "#f8fafc",
                    border: "1px solid #e5e7eb",
                    borderRadius: 8,
                    overflowX: "auto",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                  }}
                >
                  {JSON.stringify(selected.details_json || {}, null, 2)}
                </pre>
              </div>
            </div>
          );
        }}
      />
    </div>
  );
}
