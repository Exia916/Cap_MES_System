"use client";

import React, { useMemo, useState } from "react";

export type SortDir = "asc" | "desc";

export type Column<T> = {
  key: string; // used for sortBy + filter name
  header: string;

  // clicking the header should attempt sorting
  sortable?: boolean;

  /**
   * ✅ If true (default), clicking sortable header calls onToggleSort (server sort).
   * If false, we still show it (and can allow client sort later), but we will NOT call onToggleSort.
   * Use this for derived/client-only columns like Total Pieces Per Day.
   */
  serverSortable?: boolean;

  // If true, shows a text filter input in the filter row for this column
  filterable?: boolean;
  placeholder?: string;

  // Optional custom filter cell (used for date range)
  filterRender?: React.ReactNode;

  width?: number | string;

  /**
   * Optional: text extractor used by global search.
   * If omitted, DataTable will try to derive text from render output (best-effort).
   */
  getSearchText?: (row: T) => string;

  render: (row: T) => React.ReactNode;
};

type Props<T> = {
  columns: Column<T>[];
  rows: T[];

  loading?: boolean;
  error?: string | null;

  // sort (server-driven)
  sortBy: string;
  sortDir: SortDir;
  onToggleSort: (key: string) => void;

  // filters (server-driven)
  filters: Record<string, string>;
  onFilterChange: (key: string, value: string) => void;

  // pagination + count (server-driven)
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

  // ✅ NEW: enable/disable global search + placeholder
  enableGlobalSearch?: boolean;
  globalSearchPlaceholder?: string;

  /**
   * ✅ NEW: CSV export for CURRENT VIEW (what's rendered).
   * If rowToCsv is omitted, we still export using column headers + best-effort text.
   */
  enableCsvExport?: boolean;
  csvFilename?: string; // e.g. "laser-production.csv"
  rowToCsv?: (row: T) => Record<string, string | number | null | undefined>;
};

function defaultFilename() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `export_${yyyy}-${mm}-${dd}.csv`;
}

function toPlainText(node: React.ReactNode): string {
  if (node === null || node === undefined) return "";
  if (typeof node === "string" || typeof node === "number" || typeof node === "boolean") return String(node);

  if (Array.isArray(node)) return node.map(toPlainText).join(" ");

  // React element
  if (React.isValidElement(node)) {
    // @ts-ignore
    const children = node.props?.children;
    return toPlainText(children);
  }

  return "";
}

function csvEscape(v: any): string {
  const s = v === null || v === undefined ? "" : String(v);
  // Escape double-quotes; wrap if contains commas, quotes, or newlines
  const needsWrap = /[",\n\r]/.test(s);
  const escaped = s.replace(/"/g, '""');
  return needsWrap ? `"${escaped}"` : escaped;
}

function downloadCsv(filename: string, headers: string[], rows: string[][]) {
  const lines: string[] = [];
  lines.push(headers.map(csvEscape).join(","));
  for (const r of rows) lines.push(r.map(csvEscape).join(","));
  const csv = lines.join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename || defaultFilename();
  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);
}

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

  enableGlobalSearch = true,
  globalSearchPlaceholder = "Search current view…",

  enableCsvExport = true,
  csvFilename,
  rowToCsv,
}: Props<T>) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const offset = pageIndex * pageSize;

  const showingFrom = totalCount === 0 ? 0 : offset + 1;
  const showingTo = Math.min(offset + rows.length, totalCount);

  const sortIndicator = (key: string) => {
    if (sortBy !== key) return "";
    return sortDir === "asc" ? " ▲" : " ▼";
  };

  // ✅ Global search (client-side, filters CURRENT rows)
  const [globalSearch, setGlobalSearch] = useState("");

  const searchableColumns = useMemo(() => {
    return columns.filter((c) => c.key !== "edit"); // ignore edit link column by default
  }, [columns]);

  const filteredRows = useMemo(() => {
    const q = globalSearch.trim().toLowerCase();
    if (!enableGlobalSearch || !q) return rows;

    return rows.filter((row) => {
      const haystack = searchableColumns
        .map((c) => {
          if (c.getSearchText) return c.getSearchText(row) ?? "";
          return toPlainText(c.render(row));
        })
        .join(" ")
        .toLowerCase();

      return haystack.includes(q);
    });
  }, [rows, globalSearch, enableGlobalSearch, searchableColumns]);

  // ✅ Sort guard: allow click only when column is sortable AND serverSortable !== false
  function handleHeaderClick(c: Column<T>) {
    if (!c.sortable) return;

    // default is true
    const serverSortable = c.serverSortable !== false;

    if (!serverSortable) {
      // do nothing (prevents API sort key mismatch)
      return;
    }

    onToggleSort(c.key);
  }

  // ✅ CSV export for current view (filteredRows, not original rows)
  function onExportCsv() {
    const filename = (csvFilename && csvFilename.trim()) || defaultFilename();

    // if rowToCsv supplied, it defines both headers + values
    if (rowToCsv) {
      const mapped = filteredRows.map((r) => rowToCsv(r) || {});
      const headerSet = new Set<string>();
      for (const m of mapped) Object.keys(m).forEach((k) => headerSet.add(k));
      const headers = Array.from(headerSet);

      const outRows = mapped.map((m) => headers.map((h) => (m as any)[h]));
      downloadCsv(filename, headers, outRows as any);
      return;
    }

    // else: export based on columns (skip edit column)
    const exportCols = columns.filter((c) => c.key !== "edit");
    const headers = exportCols.map((c) => c.header);

    const outRows = filteredRows.map((r) =>
      exportCols.map((c) => {
        if (c.getSearchText) return c.getSearchText(r);
        return toPlainText(c.render(r));
      })
    );

    downloadCsv(filename, headers, outRows);
  }

  return (
    <div style={{ marginTop: 16 }}>
      {/* Toolbar + result count + pager */}
      <div style={topBar}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          {toolbar}

          {enableGlobalSearch ? (
            <input
              style={globalSearchInput}
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
              placeholder={globalSearchPlaceholder}
              disabled={loading}
            />
          ) : null}

          {enableCsvExport ? (
            <button type="button" style={btnSecondary} onClick={onExportCsv} disabled={loading || filteredRows.length === 0}>
              Export CSV
            </button>
          ) : null}

          {enableGlobalSearch && globalSearch.trim() ? (
            <button
              type="button"
              style={btnSecondary}
              onClick={() => setGlobalSearch("")}
              disabled={loading}
              title="Clear search"
            >
              Clear Search
            </button>
          ) : null}
        </div>

        <div style={topBarRight}>
          <div style={{ fontSize: 12, opacity: 0.8 }}>
            {loading ? (
              <>Loading…</>
            ) : enableGlobalSearch && globalSearch.trim() ? (
              <>Showing {filteredRows.length} of {rows.length} (filtered) • {showingFrom}–{showingTo} of {totalCount}</>
            ) : (
              <>Showing {showingFrom}–{showingTo} of {totalCount}</>
            )}
          </div>

          <label style={{ fontSize: 12, opacity: 0.9 }}>
            Page Size:{" "}
            <select value={pageSize} onChange={(e) => onPageSizeChange(Number(e.target.value))} disabled={loading}>
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
            {columns.map((c) => {
              const isClickable = !!c.sortable && c.serverSortable !== false;
              return (
                <th
                  key={c.key}
                  style={{ ...(isClickable ? thBtn : th), width: c.width, opacity: c.sortable && c.serverSortable === false ? 0.65 : 1 }}
                  onClick={isClickable ? () => handleHeaderClick(c) : undefined}
                  role={isClickable ? "button" : undefined}
                  title={
                    c.sortable
                      ? c.serverSortable === false
                        ? "Sorting disabled for this column"
                        : "Sort"
                      : undefined
                  }
                >
                  {c.header}
                  {c.sortable ? sortIndicator(c.key) : null}
                </th>
              );
            })}
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
          ) : filteredRows.length === 0 ? (
            <tr>
              <td style={td} colSpan={columns.length}>
                {emptyText}
              </td>
            </tr>
          ) : (
            filteredRows.map((r) => (
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

const globalSearchInput: React.CSSProperties = {
  width: 240,
  fontSize: 12,
  padding: "6px 10px",
  border: "1px solid #ddd",
  borderRadius: 6,
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
