"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type DailyProductionRow = {
  id: string;
  submissionId: string | null;
  entryTs: string;
  name: string;
  machineNumber: number | null;
  salesOrder: number | null;
  detailNumber: number | null;
  embroideryLocation: string | null;
  stitches: number | null;
  pieces: number | null;
  is3d: boolean;
  isKnit: boolean;
  detailComplete: boolean;
  notes: string | null;
};

function getDefaultShiftDateYYYYMMDD(): string {
  const now = new Date();

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const yyyy = parts.find((p) => p.type === "year")?.value ?? "1970";
  const mm = parts.find((p) => p.type === "month")?.value ?? "01";
  const dd = parts.find((p) => p.type === "day")?.value ?? "01";

  return `${yyyy}-${mm}-${dd}`;
}

function fmtBool(v: unknown) {
  return v ? "TRUE" : "FALSE";
}

export default function DailyProductionPage() {
  const [rows, setRows] = useState<DailyProductionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shiftDate, setShiftDate] = useState(() => getDefaultShiftDateYYYYMMDD());

  async function load(date: string) {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/daily-production-list?shiftDate=${encodeURIComponent(date)}`,
        { credentials: "include" }
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to load entries.");
      setRows(Array.isArray(data?.entries) ? data.entries : []);
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
          <input
            type="date"
            value={shiftDate}
            onChange={(e) => setShiftDate(e.target.value)}
          />
        </label>
      </div>

      {loading && <p>Loading…</p>}
      {error && <p style={{ color: "crimson" }}>{error}</p>}
      {!loading && !error && rows.length === 0 && <p>No entries found.</p>}

      {!loading && !error && rows.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <table style={table}>
            <thead>
              <tr>
                <th style={th}>DATE / TIME</th>
                <th style={th}>NAME</th>
                <th style={th}>MACHINE</th>
                <th style={th}>SO</th>
                <th style={th}>DETAIL</th>
                <th style={th}>LOCATION</th>
                <th style={th}>STITCHES</th>
                <th style={th}>PIECES</th>
                <th style={th}>3D</th>
                <th style={th}>KNIT</th>
                <th style={th}>COMPLETE</th>
                <th style={th}>NOTES</th>
                <th style={th}></th>
              </tr>
            </thead>

            <tbody>
              {rows.map((r) => {
                const editHref = r.submissionId
                  ? `/daily-production/${r.submissionId}`
                  : `/daily-production/${r.id}`; // fallback (old rows)

                return (
                  <tr key={r.id}>
                    <td style={td}>{r.entryTs ?? ""}</td>
                    <td style={td}>{r.name ?? ""}</td>
                    <td style={td}>{r.machineNumber ?? ""}</td>
                    <td style={td}>{r.salesOrder ?? ""}</td>
                    <td style={td}>{r.detailNumber ?? ""}</td>
                    <td style={td}>{r.embroideryLocation ?? ""}</td>
                    <td style={td}>{r.stitches ?? ""}</td>
                    <td style={td}>{r.pieces ?? ""}</td>
                    <td style={td}>{fmtBool(r.is3d)}</td>
                    <td style={td}>{fmtBool(r.isKnit)}</td>
                    <td style={td}>{fmtBool(r.detailComplete)}</td>
                    <td style={{ ...td, whiteSpace: "normal" }}>{r.notes ?? ""}</td>
                    <td style={td}>
                      <Link href={editHref}>Edit</Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <p style={{ marginTop: 12, fontSize: 12, opacity: 0.8 }}>
            Edit opens the submission editor (new saves) when a submission id exists.
          </p>
        </div>
      )}
    </div>
  );
}

/* ---------- Styles ---------- */

const page: React.CSSProperties = {
  padding: 24,
  maxWidth: "100%",
};

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

