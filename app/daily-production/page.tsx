"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

function getDefaultShiftDateYYYYMMDD(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const yyyy = parts.find((p) => p.type === "year")?.value ?? "1970";
  const mm = parts.find((p) => p.type === "month")?.value ?? "01";
  const dd = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${yyyy}-${mm}-${dd}`;
}

type SubmissionRow = {
  id: string;
  entryTs: string;
  name: string;
  machineNumber: number | null;
  salesOrder: number | null;
  lineCount: number;
  totalStitches: number | null;
  totalPieces: number | null;
  notes: string | null;
};

export default function DailyProductionPage() {
  const [shiftDate, setShiftDate] = useState(() => getDefaultShiftDateYYYYMMDD());
  const [rows, setRows] = useState<SubmissionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load(date: string) {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/daily-production-submission-list?shiftDate=${encodeURIComponent(date)}`,
        { credentials: "include" }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to load submissions.");
      setRows(Array.isArray(data?.submissions) ? data.submissions : []);
    } catch (e: any) {
      setError(e?.message || "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(shiftDate);
  }, [shiftDate]);

  return (
    <div style={page}>
      <div style={headerRow}>
        <h1 style={{ margin: 0 }}>Daily Production</h1>
        <Link href="/daily-production/add">Add Entry</Link>
      </div>

      <div style={{ marginTop: 12 }}>
        <label>
          Shift Date:{" "}
          <input type="date" value={shiftDate} onChange={(e) => setShiftDate(e.target.value)} />
        </label>
      </div>

      {loading && <p>Loading…</p>}
      {error && <p style={{ color: "crimson" }}>{error}</p>}
      {!loading && !error && rows.length === 0 && <p>No submissions found.</p>}

      {!loading && !error && rows.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <table style={table}>
            <thead>
              <tr>
                <th style={th}>DATE / TIME</th>
                <th style={th}>NAME</th>
                <th style={th}>MACHINE</th>
                <th style={th}>SO</th>
                <th style={th}>LINES</th>
                <th style={th}>TOTAL STITCHES</th>
                <th style={th}>TOTAL PIECES</th>
                <th style={th}>NOTES</th>
                <th style={th}></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td style={td}>{r.entryTs}</td>
                  <td style={td}>{r.name}</td>
                  <td style={td}>{r.machineNumber ?? ""}</td>
                  <td style={td}>{r.salesOrder ?? ""}</td>
                  <td style={td}>{r.lineCount}</td>
                  <td style={td}>{r.totalStitches ?? ""}</td>
                  <td style={td}>{r.totalPieces ?? ""}</td>
                  <td style={{ ...td, whiteSpace: "normal" }}>{r.notes ?? ""}</td>
                  <td style={td}>
                    <Link href={`/daily-production/${r.id}`}>Edit</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ marginTop: 8, fontSize: 12, opacity: 0.75 }}>
            Note: This list shows submissions created after the new submission system was enabled.
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Styles ---------- */

const page: React.CSSProperties = { padding: 24, maxWidth: "100%" };

const headerRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
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

const td: React.CSSProperties = {
  borderBottom: "1px solid #eee",
  padding: 8,
  verticalAlign: "top",
};
