"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Totals = {
  total_pieces: number | string;
};

type Row = {
  entry_ts: string;
  entry_date: string;
  name: string;
  employee_number: number;

  sales_order: number;
  detail_number: number;
  emblem_type: string;
  logo_name: string;
  pieces: number;
  notes: string | null;

  total_pieces: number;
  sew: number;
  sticker: number;
  heat_seal: number;

  total_pieces_by_person: number;
  total_sew_by_person: number;
  total_sticker_by_person: number;
  total_heat_seal_by_person: number;
};

type ApiResponse = {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  rows: Row[];
  totals: Totals;
};

const nf0 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

function fmtInt(v: any) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "";
  return nf0.format(n);
}
// ✅ Employee Number with NO commas
function fmtEmployeeNumberNoCommas(v: any) {
  const s = v === null || v === undefined ? "" : String(v);
  return s.replace(/,/g, "");
}
// Dates
const dateFmt = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const tsFmt = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "numeric",
  minute: "2-digit",
});

function fmtDateOnly(value: any) {
  if (!value) return "";
  const s = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split("-").map(Number);
    return dateFmt.format(new Date(y, m - 1, d));
  }
  const dt = new Date(s);
  if (Number.isNaN(dt.getTime())) return s;
  return dateFmt.format(dt);
}

function fmtTimestamp(value: any) {
  if (!value) return "";
  const dt = new Date(String(value));
  if (Number.isNaN(dt.getTime())) return String(value);
  return tsFmt.format(dt);
}

type SortDir = "asc" | "desc";
type SortKey =
  | "entry_ts"
  | "entry_date"
  | "name"
  | "employee_number"
  | "sales_order"
  | "detail_number"
  | "emblem_type"
  | "logo_name"
  | "pieces"
  | "total_pieces"
  | "sew"
  | "sticker"
  | "heat_seal"
  | "total_pieces_by_person"
  | "total_sew_by_person"
  | "total_sticker_by_person"
  | "total_heat_seal_by_person";

function SortHeader({
  label,
  sortKey,
  activeSort,
  activeDir,
  onChange,
}: {
  label: string;
  sortKey: SortKey;
  activeSort: SortKey;
  activeDir: SortDir;
  onChange: (k: SortKey) => void;
}) {
  const isActive = activeSort === sortKey;
  const arrow = isActive ? (activeDir === "asc" ? " ▲" : " ▼") : "";
  return (
    <th
      onClick={() => onChange(sortKey)}
      style={{
        textAlign: "left",
        padding: 10,
        borderBottom: "1px solid #ddd",
        background: "#fafafa",
        whiteSpace: "nowrap",
        cursor: "pointer",
        userSelect: "none",
      }}
      title="Click to sort"
    >
      {label}
      <span style={{ color: "#6b7280" }}>{arrow}</span>
    </th>
  );
}

export default function EmblemProductionAllTable({
  defaultStart,
  defaultEnd,
}: {
  defaultStart: string;
  defaultEnd: string;
}) {
  // top horizontal scrollbar refs
  const topScrollRef = useRef<HTMLDivElement | null>(null);
  const topScrollInnerRef = useRef<HTMLDivElement | null>(null);
  const tableScrollRef = useRef<HTMLDivElement | null>(null);

  // controls
  const [showAll, setShowAll] = useState(false);
  const [start, setStart] = useState(defaultStart);
  const [end, setEnd] = useState(defaultEnd);

  // ✅ NEW: global search
  const [q, setQ] = useState("");

  // filters
  const [name, setName] = useState("");
  const [employeeNumber, setEmployeeNumber] = useState("");
  const [salesOrder, setSalesOrder] = useState("");
  const [detailNumber, setDetailNumber] = useState("");
  const [emblemType, setEmblemType] = useState("");
  const [logoName, setLogoName] = useState("");
  const [pieces, setPieces] = useState("");
  const [notes, setNotes] = useState("");

  // paging + sort
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [sort, setSort] = useState<SortKey>("entry_ts");
  const [dir, setDir] = useState<SortDir>("desc");

  // data
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const query = useMemo(() => {
    const p = new URLSearchParams();

    if (showAll) {
      p.set("all", "1");
    } else {
      if (start) p.set("start", start);
      if (end) p.set("end", end);
    }

    // ✅ NEW: global search param
    if (q) p.set("q", q);

    if (name) p.set("name", name);
    if (employeeNumber) p.set("employee_number", employeeNumber);
    if (salesOrder) p.set("sales_order", salesOrder);
    if (detailNumber) p.set("detail_number", detailNumber);
    if (emblemType) p.set("emblem_type", emblemType);
    if (logoName) p.set("logo_name", logoName);
    if (pieces) p.set("pieces", pieces);
    if (notes) p.set("notes", notes);

    p.set("page", String(page));
    p.set("pageSize", String(pageSize));
    p.set("sort", sort);
    p.set("dir", dir);

    return p.toString();
  }, [
    showAll,
    start,
    end,
    q,
    name,
    employeeNumber,
    salesOrder,
    detailNumber,
    emblemType,
    logoName,
    pieces,
    notes,
    page,
    pageSize,
    sort,
    dir,
  ]);

  async function load(qs: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/emblem-production-all?${qs}`, { cache: "no-store" });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "Failed to load");
      setData(j);
    } catch (e: any) {
      setError(e?.message || "Failed to load");
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  // 400ms debounce
  useEffect(() => {
    const t = setTimeout(() => load(query), 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  // reset page when filters change
  useEffect(() => {
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    showAll,
    start,
    end,
    q,
    name,
    employeeNumber,
    salesOrder,
    detailNumber,
    emblemType,
    logoName,
    pieces,
    notes,
    pageSize,
  ]);

  function exportCsv() {
    const p = new URLSearchParams(query);
    p.set("format", "csv");
    window.location.href = `/api/admin/emblem-production-all?${p.toString()}`;
  }

  function toggleSort(next: SortKey) {
    if (sort === next) setDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSort(next);
      setDir("asc");
    }
  }

  const rows = data?.rows || [];
  const totals = data?.totals;
  const totalPages = data?.totalPages || 1;

  // top scrollbar sync
  useEffect(() => {
    const top = topScrollRef.current;
    const inner = topScrollInnerRef.current;
    const body = tableScrollRef.current;
    if (!top || !inner || !body) return;

    let raf = 0;

    const setInnerWidth = () => {
      inner.style.width = `${body.scrollWidth}px`;
    };

    const onTopScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        if (body.scrollLeft !== top.scrollLeft) body.scrollLeft = top.scrollLeft;
      });
    };

    const onBodyScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        if (top.scrollLeft !== body.scrollLeft) top.scrollLeft = body.scrollLeft;
      });
    };

    top.addEventListener("scroll", onTopScroll, { passive: true });
    body.addEventListener("scroll", onBodyScroll, { passive: true });

    setInnerWidth();

    let ro: ResizeObserver | null = null;
    const canRO = typeof ResizeObserver !== "undefined";
    if (canRO) {
      ro = new ResizeObserver(() => setInnerWidth());
      ro.observe(body);
    } else {
      window.addEventListener("resize", setInnerWidth);
    }

    return () => {
      cancelAnimationFrame(raf);
      top.removeEventListener("scroll", onTopScroll);
      body.removeEventListener("scroll", onBodyScroll);
      if (ro) ro.disconnect();
      if (!canRO) window.removeEventListener("resize", setInnerWidth);
    };
  }, [rows.length, pageSize]);

  // UI styles
  const btn = (variant: "primary" | "ghost" = "primary"): React.CSSProperties => ({
    height: 36,
    padding: "0 14px",
    borderRadius: 10,
    border: variant === "primary" ? "1px solid #111827" : "1px solid #d1d5db",
    background: variant === "primary" ? "#111827" : "#ffffff",
    color: variant === "primary" ? "#ffffff" : "#111827",
    fontWeight: 700,
    fontSize: 13,
    cursor: "pointer",
    opacity: loading ? 0.85 : 1,
  });

  const controlBox: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: 10,
    borderRadius: 12,
    border: "1px solid #e5e7eb",
    background: "#f9fafb",
  };

  const label: React.CSSProperties = { fontSize: 12, color: "#374151", fontWeight: 700 };
  const input: React.CSSProperties = {
    height: 34,
    borderRadius: 10,
    border: "1px solid #d1d5db",
    padding: "0 10px",
    background: "#fff",
    fontSize: 13,
    outline: "none",
  };
  const select: React.CSSProperties = { ...input, paddingRight: 8, cursor: "pointer" };

  return (
    <div style={{ border: "1px solid #ddd", borderRadius: 14, padding: 12, width: "100%" }}>
      {/* top controls */}
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
        <div style={controlBox}>
          <button onClick={exportCsv} style={btn("primary")}>
            Export CSV
          </button>

          <label style={{ display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
            <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />
            <span style={label}>Show All Entries</span>
          </label>
        </div>

        {!showAll ? (
          <div style={controlBox}>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={label}>Start</span>
              <input type="date" value={start} onChange={(e) => setStart(e.target.value)} style={input} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={label}>End</span>
              <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} style={input} />
            </div>
          </div>
        ) : null}

        {/* ✅ NEW: Global Search */}
        <div style={controlBox}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={label}>Search</span>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search: name, emp#, SO, detail, type, logo, pieces, notes…"
              style={{ ...input, width: 360 }}
            />
          </div>

          {q ? (
            <button type="button" style={btn("ghost")} onClick={() => setQ("")} disabled={loading} title="Clear search">
              Clear
            </button>
          ) : null}
        </div>

        <div style={{ ...controlBox, marginLeft: "auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={label}>Page Size</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPage(1);
                setPageSize(Number(e.target.value));
              }}
              style={select}
            >
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={250}>250</option>
              <option value={500}>500</option>
            </select>
          </div>

          <button style={btn("ghost")} disabled={page <= 1 || loading} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            Prev
          </button>

          <div style={{ fontSize: 12, color: "#374151", fontWeight: 800 }}>
            Page {page} / {totalPages}
          </div>

          <button style={btn("ghost")} disabled={page >= totalPages || loading} onClick={() => setPage((p) => p + 1)}>
            Next
          </button>
        </div>
      </div>

      {/* totals */}
      <div style={{ display: "flex", gap: 18, marginBottom: 10, color: "#111827", flexWrap: "wrap" }}>
        <div style={{ fontWeight: 800 }}>Total Pieces: {fmtInt(totals?.total_pieces ?? 0)}</div>
        <div style={{ marginLeft: "auto", fontWeight: 800 }}>Rows: {fmtInt(data?.totalCount ?? 0)}</div>
      </div>

      {error && <div style={{ color: "crimson", marginBottom: 10 }}>{error}</div>}
      {loading && <div style={{ marginBottom: 10, fontWeight: 700 }}>Loading…</div>}

      {/* top horizontal scrollbar */}
      <div
        ref={topScrollRef}
        style={{
          overflowX: "auto",
          overflowY: "hidden",
          height: 16,
          border: "1px solid #eee",
          borderRadius: 10,
          width: "100%",
          background: "#fff",
          marginBottom: 8,
        }}
        title="Horizontal scroll"
      >
        <div ref={topScrollInnerRef} style={{ height: 1 }} />
      </div>

      {/* table */}
      <div ref={tableScrollRef} style={{ overflowX: "auto", border: "1px solid #eee", borderRadius: 10, width: "100%", background: "#fff" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 2200 }}>
          <thead>
            <tr>
              <SortHeader label="Timestamp" sortKey="entry_ts" activeSort={sort} activeDir={dir} onChange={toggleSort} />
              <SortHeader label="Date" sortKey="entry_date" activeSort={sort} activeDir={dir} onChange={toggleSort} />

              <SortHeader label="Name" sortKey="name" activeSort={sort} activeDir={dir} onChange={toggleSort} />
              <SortHeader label="Sales Order #" sortKey="sales_order" activeSort={sort} activeDir={dir} onChange={toggleSort} />
              <SortHeader label="Detail #" sortKey="detail_number" activeSort={sort} activeDir={dir} onChange={toggleSort} />
              <SortHeader label="Emblem Type" sortKey="emblem_type" activeSort={sort} activeDir={dir} onChange={toggleSort} />
              <SortHeader label="Logo Name" sortKey="logo_name" activeSort={sort} activeDir={dir} onChange={toggleSort} />
              <SortHeader label="Pieces" sortKey="pieces" activeSort={sort} activeDir={dir} onChange={toggleSort} />

              <th style={{ textAlign: "left", padding: 10, borderBottom: "1px solid #ddd", background: "#fafafa", whiteSpace: "nowrap" }}>
                Notes
              </th>

              <SortHeader label="Total Pieces" sortKey="total_pieces" activeSort={sort} activeDir={dir} onChange={toggleSort} />
              <SortHeader label="Sew" sortKey="sew" activeSort={sort} activeDir={dir} onChange={toggleSort} />
              <SortHeader label="Sticker" sortKey="sticker" activeSort={sort} activeDir={dir} onChange={toggleSort} />
              <SortHeader label="Heat Seal" sortKey="heat_seal" activeSort={sort} activeDir={dir} onChange={toggleSort} />
              <SortHeader label="Total Pieces By Person" sortKey="total_pieces_by_person" activeSort={sort} activeDir={dir} onChange={toggleSort} />
              <SortHeader label="Total Sew By Person" sortKey="total_sew_by_person" activeSort={sort} activeDir={dir} onChange={toggleSort} />
              <SortHeader label="Total Sticker By Person" sortKey="total_sticker_by_person" activeSort={sort} activeDir={dir} onChange={toggleSort} />
              <SortHeader label="Total Heat Seal By Person" sortKey="total_heat_seal_by_person" activeSort={sort} activeDir={dir} onChange={toggleSort} />
              <SortHeader label="Employee #" sortKey="employee_number" activeSort={sort} activeDir={dir} onChange={toggleSort} />
            </tr>

            {/* filters row */}
            <tr>
              <th style={{ padding: 6, borderBottom: "1px solid #ddd", background: "#fff" }}>
                <input disabled placeholder="Timestamp" style={{ ...input, width: 130, opacity: 0.55 }} />
              </th>

              <th style={{ padding: 6, borderBottom: "1px solid #ddd", background: "#fff", whiteSpace: "nowrap" }}>
                <span style={{ fontSize: 11, color: "#6b7280" }}>{showAll ? "All" : "Range"}</span>
              </th>

              <th style={{ padding: 6, borderBottom: "1px solid #ddd", background: "#fff" }}>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" style={{ ...input, width: 160 }} />
              </th>
              <th style={{ padding: 6, borderBottom: "1px solid #ddd", background: "#fff" }}>
                <input value={salesOrder} onChange={(e) => setSalesOrder(e.target.value)} placeholder="Sales Order" style={{ ...input, width: 120 }} />
              </th>
              <th style={{ padding: 6, borderBottom: "1px solid #ddd", background: "#fff" }}>
                <input value={detailNumber} onChange={(e) => setDetailNumber(e.target.value)} placeholder="Detail #" style={{ ...input, width: 110 }} />
              </th>

              <th style={{ padding: 6, borderBottom: "1px solid #ddd", background: "#fff" }}>
                <input value={emblemType} onChange={(e) => setEmblemType(e.target.value)} placeholder="Type" style={{ ...input, width: 120 }} />
              </th>
              <th style={{ padding: 6, borderBottom: "1px solid #ddd", background: "#fff" }}>
                <input value={logoName} onChange={(e) => setLogoName(e.target.value)} placeholder="Logo Name" style={{ ...input, width: 150 }} />
              </th>
              <th style={{ padding: 6, borderBottom: "1px solid #ddd", background: "#fff" }}>
                <input value={pieces} onChange={(e) => setPieces(e.target.value)} placeholder="Pieces" style={{ ...input, width: 90 }} />
              </th>
              <th style={{ padding: 6, borderBottom: "1px solid #ddd", background: "#fff" }}>
                <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes contains" style={{ ...input, width: 220 }} />
              </th>

              {/* display-only */}
              {Array.from({ length: 8 }).map((_, idx) => (
                <th key={idx} style={{ padding: 6, borderBottom: "1px solid #ddd", background: "#fff" }}>
                  <input disabled style={{ ...input, width: 160, opacity: 0.55 }} />
                </th>
              ))}

              <th style={{ padding: 6, borderBottom: "1px solid #ddd", background: "#fff" }}>
                <input value={employeeNumber} onChange={(e) => setEmployeeNumber(e.target.value)} placeholder="Emp#" style={{ ...input, width: 110 }} />
              </th>
            </tr>
          </thead>

          <tbody>
            {rows.map((r, idx) => (
              <tr key={`${r.entry_ts}-${r.sales_order}-${r.detail_number}-${idx}`}>
                <td style={{ padding: 10, borderBottom: "1px solid #eee", whiteSpace: "nowrap" }}>{fmtTimestamp(r.entry_ts)}</td>
                <td style={{ padding: 10, borderBottom: "1px solid #eee", whiteSpace: "nowrap" }}>{fmtDateOnly(r.entry_date)}</td>

                <td style={{ padding: 10, borderBottom: "1px solid #eee" }}>{r.name}</td>
                <td style={{ padding: 10, borderBottom: "1px solid #eee" }}>{String(r.sales_order ?? "")}</td>
                <td style={{ padding: 10, borderBottom: "1px solid #eee" }}>{fmtInt(r.detail_number)}</td>

                <td style={{ padding: 10, borderBottom: "1px solid #eee" }}>{r.emblem_type}</td>
                <td style={{ padding: 10, borderBottom: "1px solid #eee" }}>{r.logo_name}</td>
                <td style={{ padding: 10, borderBottom: "1px solid #eee" }}>{fmtInt(r.pieces)}</td>
                <td style={{ padding: 10, borderBottom: "1px solid #eee", maxWidth: 520 }}>{r.notes || ""}</td>

                <td style={{ padding: 10, borderBottom: "1px solid #eee" }}>{fmtInt(r.total_pieces)}</td>
                <td style={{ padding: 10, borderBottom: "1px solid #eee" }}>{fmtInt(r.sew)}</td>
                <td style={{ padding: 10, borderBottom: "1px solid #eee" }}>{fmtInt(r.sticker)}</td>
                <td style={{ padding: 10, borderBottom: "1px solid #eee" }}>{fmtInt(r.heat_seal)}</td>
                <td style={{ padding: 10, borderBottom: "1px solid #eee" }}>{fmtInt(r.total_pieces_by_person)}</td>
                <td style={{ padding: 10, borderBottom: "1px solid #eee" }}>{fmtInt(r.total_sew_by_person)}</td>
                <td style={{ padding: 10, borderBottom: "1px solid #eee" }}>{fmtInt(r.total_sticker_by_person)}</td>
                <td style={{ padding: 10, borderBottom: "1px solid #eee" }}>{fmtInt(r.total_heat_seal_by_person)}</td>
                <td style={{ padding: 10, borderBottom: "1px solid #eee" }}>{fmtEmployeeNumberNoCommas(r.employee_number)}</td>
              </tr>
            ))}

            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={19} style={{ padding: 16, color: "#666" }}>
                  No results for the current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {error ? null : (
        <div style={{ marginTop: 10, fontSize: 12, color: "#6b7280" }}>
          Tip: Filters auto-refresh after you stop typing (400ms). Click column headers to sort. Use the top scrollbar to scroll columns.
        </div>
      )}
    </div>
  );
}