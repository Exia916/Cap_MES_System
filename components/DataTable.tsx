"use client";

import React from "react";

export type SortDir = "asc" | "desc";

export type Column<T> = {
  key: string; // used for sortBy + filter name
  header: string;

  sortable?: boolean;

  // If true, shows a text filter input in the filter row for this column
  filterable?: boolean;
  placeholder?: string;

  // Optional custom filter cell (used for shift date range)
  filterRender?: React.ReactNode;

  width?: number | string;

  render: (row: T) => React.ReactNode;
};

type Props<T> = {
  columns: Column<T>[];
  rows: T[];

  loading?: boolean;
  error?: string | null;

  // sort
  sortBy: string;
  sortDir: SortDir;
  onToggleSort: (key: string) => void;

  // filters
  filters: Record<string, string>;
  onFilterChange: (key: string, value: string) => void;

  // pagination + count
  totalCount: number;
  pageIndex: number; // 0-based
  pageSize: number;
  pageSizes?: number[];
  onPageIndexChange: (next: number) => void;
  onPageSizeChange: (next: number) => void;

  // optional toolbar actions (e.g. clear filters, presets)
  toolbar?: React.ReactNode;

  // row key
  rowKey: (row: T) => string;

  emptyText?: string;
};

export default function DataTable<T>({
  columns,
  rows,
  loading = false,
  error = null,

  sortBy,
  sortDir,
  onToggleSort,

  filters,
  onFilterChange,

  totalCount,
  pageIndex,
  pageSize,
  pageSizes = [10, 25, 50, 100],
  onPageIndexChange,
  onPageSizeChange,

  toolbar,

  rowKey,
  emptyText = "No results found.",
}: Props<T>) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const offset = pageIndex * pageSize;

  const showingFrom = totalCount === 0 ? 0 : offset + 1;
  const showingTo = Math.min(offset + rows.length, totalCount);

  const sortIndicator = (key: string) => {
    if (sortBy !== key) return "";
    return sortDir === "asc" ? " ▲" : " ▼";
  };

  return (
    <div style={{ marginTop: 16 }}>
      {/* Toolbar + result count + pager */}
      <div style={topBar}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          {toolbar}
        </div>

        <div style={topBarRight}>
          <div style={{ fontSize: 12, opacity: 0.8 }}>
            {loading ? <>Loading…</> : <>Showing {showingFrom}–{showingTo} of {totalCount}</>}
          </div>

          <label style={{ fontSize: 12, opacity: 0.9 }}>
            Page Size:{" "}
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              disabled={loading}
            >
              {pageSizes.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            style={btnSecondary}
            onClick={() => onPageIndexChange(Math.max(0, pageIndex - 1))}
            disabled={loading || pageIndex <= 0}
          >
            Prev
          </button>

          <div style={{ fontSize: 12, opacity: 0.9 }}>
            Page {pageIndex + 1} / {totalPages}
          </div>

          <button
            type="button"
            style={btnSecondary}
            onClick={() => onPageIndexChange(Math.min(totalPages - 1, pageIndex + 1))}
            disabled={loading || pageIndex >= totalPages - 1}
          >
            Next
          </button>
        </div>
      </div>

      {/* Table */}
      <table style={table}>
        <thead>
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                style={{ ...(c.sortable ? thBtn : th), width: c.width }}
                onClick={c.sortable ? () => onToggleSort(c.key) : undefined}
                role={c.sortable ? "button" : undefined}
                title={c.sortable ? "Sort" : undefined}
              >
                {c.header}
                {c.sortable ? sortIndicator(c.key) : null}
              </th>
            ))}
          </tr>

          <tr>
            {columns.map((c) => (
              <th key={c.key} style={thFilter}>
                {c.filterRender ? (
                  c.filterRender
                ) : c.filterable ? (
                  <input
                    style={filterInput}
                    placeholder={c.placeholder ?? c.header}
                    value={filters[c.key] ?? ""}
                    onChange={(e) => onFilterChange(c.key, e.target.value)}
                  />
                ) : (
                  <span style={filterMuted}>—</span>
                )}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {error ? (
            <tr>
              <td style={td} colSpan={columns.length}>
                <span style={{ color: "crimson" }}>{error}</span>
              </td>
            </tr>
          ) : loading ? (
            <tr>
              <td style={td} colSpan={columns.length}>
                Loading…
              </td>
            </tr>
          ) : rows.length === 0 ? (
            <tr>
              <td style={td} colSpan={columns.length}>
                {emptyText}
              </td>
            </tr>
          ) : (
            rows.map((r) => (
              <tr key={rowKey(r)}>
                {columns.map((c) => (
                  <td key={c.key} style={td}>
                    {c.render(r)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

/* ---------- Styles ---------- */

const topBar: React.CSSProperties = {
  marginTop: 12,
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
  alignItems: "center",
};

const topBarRight: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  flexWrap: "wrap",
};

export const btnSecondary: React.CSSProperties = {
  padding: "6px 10px",
  border: "1px solid #ddd",
  borderRadius: 6,
  background: "#fafafa",
  cursor: "pointer",
};

const table: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  tableLayout: "auto",
};

const th: React.CSSProperties = {
  textAlign: "left",
  borderBottom: "1px solid #ddd",
  padding: 8,
  fontSize: 12,
  whiteSpace: "nowrap",
};

const thBtn: React.CSSProperties = {
  ...th,
  cursor: "pointer",
  userSelect: "none",
};

const thFilter: React.CSSProperties = {
  borderBottom: "1px solid #ddd",
  padding: 6,
  background: "#fafafa",
};

const filterInput: React.CSSProperties = {
  width: "100%",
  fontSize: 12,
  padding: "4px 6px",
  border: "1px solid #ddd",
  borderRadius: 4,
};

const filterMuted: React.CSSProperties = {
  fontSize: 12,
  opacity: 0.5,
};

const td: React.CSSProperties = {
  borderBottom: "1px solid #eee",
  padding: 8,
  verticalAlign: "top",
};
