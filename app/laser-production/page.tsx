"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import DataTable, { type Column, type SortDir } from "@/components/DataTable";

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

function fmtDateOnly(v: any): string {
  if (v === null || v === undefined) return "";
  const s = String(v);

  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return s.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  const dt = new Date(s);
  if (Number.isNaN(dt.getTime())) return s;
  return ymdChicago(dt);
}

function stripCommas(v: any) {
  const s = v === null || v === undefined ? "" : String(v);
  return s.replace(/,/g, "");
}

function addDays(d: Date, days: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

function startOfMonthChicago(ref: Date): string {
  const ymd = ymdChicago(ref);
  return `${ymd.slice(0, 8)}01`;
}

function endOfMonthChicago(ref: Date): string {
  const y = ref.getFullYear();
  const m = ref.getMonth();
  const last = new Date(y, m + 1, 0);
  return ymdChicago(last);
}

function getRangeLastNDays(n: number): { from: string; to: string } {
  const today = new Date();
  const to = ymdChicago(today);
  const from = ymdChicago(addDays(today, -(n - 1)));
  return { from, to };
}

function getRangeToday(): { from: string; to: string } {
  const t = ymdChicago(new Date());
  return { from: t, to: t };
}

function getRangeThisMonth(): { from: string; to: string } {
  const now = new Date();
  return { from: startOfMonthChicago(now), to: endOfMonthChicago(now) };
}

function getRangePrevMonth(): { from: string; to: string } {
  const now = new Date();
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 15);
  return { from: startOfMonthChicago(prev), to: endOfMonthChicago(prev) };
}

type Row = {
  id: string;
  entryTs: string;
  entryDate: string;
  name: string;
  employeeNumber: number | null;
  salesOrder: string | null;
  leatherStyleColor: string | null;
  piecesCut: number | null;
  notes: string | null;
  totalPiecesPerDay?: number;
};

type SortBy =
  | "entryTs"
  | "entryDate"
  | "name"
  | "salesOrder"
  | "leatherStyleColor"
  | "piecesCut"
  | "totalPiecesPerDay";

type Filters = {
  name: string;
  salesOrder: string;
  leatherStyleColor: string;
  notes: string;
};

const DEFAULT_FILTERS: Filters = {
  name: "",
  salesOrder: "",
  leatherStyleColor: "",
  notes: "",
};

export default function LaserProductionListPage() {
  const def = useMemo(() => getRangeLastNDays(30), []);
  const [entryDateFrom, setEntryDateFrom] = useState(def.from);
  const [entryDateTo, setEntryDateTo] = useState(def.to);

  const [rows, setRows] = useState<Row[]>([]);
  const [totalCount, setTotalCount] = useState(0);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [sortBy, setSortBy] = useState<SortBy>("entryTs");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [debouncedFilters, setDebouncedFilters] = useState<Filters>(DEFAULT_FILTERS);

  const [pageSize, setPageSize] = useState(25);
  const [pageIndex, setPageIndex] = useState(0);

  const offset = pageIndex * pageSize;

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedFilters(filters), 300);
    return () => window.clearTimeout(t);
  }, [filters]);

  useEffect(() => {
    setPageIndex(0);
  }, [entryDateFrom, entryDateTo, sortBy, sortDir, debouncedFilters, pageSize]);

  const queryString = useMemo(() => {
    const sp = new URLSearchParams();
    sp.set("entryDateFrom", entryDateFrom);
    sp.set("entryDateTo", entryDateTo);

    sp.set("sortBy", sortBy);
    sp.set("sortDir", sortDir);

    sp.set("limit", String(pageSize));
    sp.set("offset", String(offset));

    if (debouncedFilters.name.trim()) sp.set("name", debouncedFilters.name.trim());
    if (debouncedFilters.salesOrder.trim()) sp.set("salesOrder", debouncedFilters.salesOrder.trim());
    if (debouncedFilters.leatherStyleColor.trim()) {
      sp.set("leatherStyleColor", debouncedFilters.leatherStyleColor.trim());
    }
    if (debouncedFilters.notes.trim()) sp.set("notes", debouncedFilters.notes.trim());

    return sp.toString();
  }, [entryDateFrom, entryDateTo, sortBy, sortDir, debouncedFilters, pageSize, offset]);

  async function load(qs: string) {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/laser-production-list?${qs}`, {
        credentials: "include",
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to load laser entries.");

      const rawRows: Row[] = Array.isArray(data?.entries) ? data.entries : [];

      const totalsByDate = new Map<string, number>();
      for (const r of rawRows) {
        const key = fmtDateOnly(r.entryDate ?? r.entryTs);
        const pcs = Number(r.piecesCut ?? 0) || 0;
        totalsByDate.set(key, (totalsByDate.get(key) ?? 0) + pcs);
      }

      const withTotals = rawRows.map((r) => {
        const key = fmtDateOnly(r.entryDate ?? r.entryTs);
        return { ...r, totalPiecesPerDay: totalsByDate.get(key) ?? 0 };
      });

      setRows(withTotals);
      setTotalCount(Number.isFinite(data?.totalCount) ? Number(data.totalCount) : 0);
    } catch (e: any) {
      setError(e?.message || "Unknown error");
      setRows([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(queryString);
  }, [queryString]);

  function onToggleSort(key: string) {
    const next = key as SortBy;
    if (sortBy !== next) {
      setSortBy(next);
      setSortDir("asc");
      return;
    }
    setSortDir((d) => (d === "asc" ? "desc" : "asc"));
  }

  function onFilterChange(key: string, value: string) {
    if (key in DEFAULT_FILTERS) {
      setFilters((f) => ({ ...f, [key]: value }));
    }
  }

  function clearFilters() {
    setFilters(DEFAULT_FILTERS);
    setEntryDateFrom(def.from);
    setEntryDateTo(def.to);
    setSortBy("entryTs");
    setSortDir("desc");
    setPageIndex(0);
  }

  function applyRange(r: { from: string; to: string }) {
    setEntryDateFrom(r.from);
    setEntryDateTo(r.to);
  }

  const columns: Column<Row>[] = useMemo(
    () => [
      {
        key: "entryDate",
        header: "ENTRY DATE",
        sortable: true,
        filterRender: (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input
              style={filterInput}
              type="date"
              value={entryDateFrom}
              onChange={(e) => setEntryDateFrom(e.target.value)}
            />
            <span style={{ fontSize: 12, opacity: 0.7 }}>–</span>
            <input
              style={filterInput}
              type="date"
              value={entryDateTo}
              onChange={(e) => setEntryDateTo(e.target.value)}
            />
          </div>
        ),
        render: (r) => fmtDateOnly(r.entryDate ?? r.entryTs),
        getSearchText: (r) => fmtDateOnly(r.entryDate ?? r.entryTs),
      },
      {
        key: "name",
        header: "NAME",
        sortable: true,
        filterable: true,
        placeholder: "Name",
        render: (r) => r.name ?? "",
        getSearchText: (r) => r.name ?? "",
      },
      {
        key: "salesOrder",
        header: "SO",
        sortable: true,
        filterable: true,
        placeholder: "SO (starts with)",
        render: (r) => stripCommas(r.salesOrder ?? ""),
        getSearchText: (r) => stripCommas(r.salesOrder ?? ""),
      },
      {
        key: "leatherStyleColor",
        header: "LEATHER STYLE/COLOR",
        sortable: true,
        filterable: true,
        placeholder: "Style/Color",
        render: (r) => r.leatherStyleColor ?? "",
        getSearchText: (r) => r.leatherStyleColor ?? "",
      },
      {
        key: "piecesCut",
        header: "PIECES CUT",
        sortable: true,
        render: (r) => r.piecesCut ?? 0,
        getSearchText: (r) => String(r.piecesCut ?? 0),
      },
      {
        key: "totalPiecesPerDay",
        header: "TOTAL PIECES PER DAY",
        sortable: true,
        serverSortable: false,
        render: (r) => r.totalPiecesPerDay ?? 0,
        getSearchText: (r) => String(r.totalPiecesPerDay ?? 0),
      },
      {
        key: "notes",
        header: "NOTES",
        filterable: true,
        placeholder: "Notes",
        render: (r) => <span style={{ whiteSpace: "normal" }}>{r.notes ?? ""}</span>,
        getSearchText: (r) => r.notes ?? "",
      },
      {
        key: "view",
        header: "",
        render: (r) => (
          <Link href={`/laser-production/${r.id}`} className="btn btn-secondary btn-sm">
            View
          </Link>
        ),
      },
      {
        key: "edit",
        header: "",
        render: (r) => (
          <Link href={`/laser-production/${r.id}/edit`} className="btn btn-primary btn-sm">
            Edit
          </Link>
        ),
      },
    ],
    [entryDateFrom, entryDateTo]
  );

  const toolbar = (
    <>
      <button type="button" onClick={clearFilters} className="btn btn-secondary" disabled={loading}>
        Clear Filters
      </button>
      <button type="button" onClick={() => applyRange(getRangeLastNDays(7))} className="btn btn-secondary" disabled={loading}>
        Last 7
      </button>
      <button type="button" onClick={() => applyRange(getRangeLastNDays(30))} className="btn btn-secondary" disabled={loading}>
        Last 30
      </button>
      <button type="button" onClick={() => applyRange(getRangeLastNDays(90))} className="btn btn-secondary" disabled={loading}>
        Last 90
      </button>
      <button type="button" onClick={() => applyRange(getRangeThisMonth())} className="btn btn-secondary" disabled={loading}>
        This Month
      </button>
      <button type="button" onClick={() => applyRange(getRangePrevMonth())} className="btn btn-secondary" disabled={loading}>
        Prev Month
      </button>
      <button type="button" onClick={() => applyRange(getRangeToday())} className="btn btn-secondary" disabled={loading}>
        Today Only
      </button>
    </>
  );

  return (
    <div className="page-shell-wide">
      <div className="page-header">
        <h1 className="page-title">Laser Production</h1>
        <Link href="/laser-production/add" className="btn btn-primary">
          + Add Entry
        </Link>
      </div>

      <DataTable<Row>
        columns={columns}
        rows={rows}
        loading={loading}
        error={error}
        sortBy={sortBy}
        sortDir={sortDir}
        onToggleSort={onToggleSort}
        filters={filters}
        onFilterChange={onFilterChange}
        totalCount={totalCount}
        pageIndex={pageIndex}
        pageSize={pageSize}
        onPageIndexChange={setPageIndex}
        onPageSizeChange={setPageSize}
        toolbar={toolbar}
        rowKey={(r) => r.id}
        emptyText="No laser entries found."
        globalSearchPlaceholder="Search current view… (SO, style/color, name, notes)"
        csvFilename="laser-production.csv"
        rowToCsv={(r) => ({
          "Entry Date": fmtDateOnly(r.entryDate ?? r.entryTs),
          Name: r.name ?? "",
          SO: stripCommas(r.salesOrder ?? ""),
          "Leather Style/Color": r.leatherStyleColor ?? "",
          "Pieces Cut": r.piecesCut ?? 0,
          "Total Pieces Per Day": r.totalPiecesPerDay ?? 0,
          Notes: r.notes ?? "",
        })}
      />
    </div>
  );
}

const filterInput: React.CSSProperties = {
  width: "100%",
  fontSize: 12,
  padding: "4px 6px",
  border: "1px solid #ddd",
  borderRadius: 4,
};
