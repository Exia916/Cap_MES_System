"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Row = any;

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

export default function QCDailyProductionPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shiftDate, setShiftDate] = useState(() => getDefaultShiftDateYYYYMMDD());

  async function load(date: string) {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/qc-daily-production-list?entryDate=${encodeURIComponent(date)}`)
;
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to load QC entries.");
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
    <div style={{ padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ margin: 0 }}>QC Daily Production</h1>
        <Link href="/qc-daily-production/add">Add Entry</Link>
      </div>

      <div style={{ marginTop: 12 }}>
        <label>
          Shift Date:{" "}
          <input type="date" value={shiftDate} onChange={(e) => setShiftDate(e.target.value)} />
        </label>
      </div>

      {loading && <p>Loading…</p>}
      {error && <p style={{ color: "crimson" }}>{error}</p>}
      {!loading && !error && rows.length === 0 && <p>No entries found.</p>}

      {!loading && !error && rows.length > 0 && (
        <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 16 }}>
          <thead>
            <tr>
              <th style={th}>DATE / TIME</th>
              <th style={th}>NAME</th>
              <th style={th}>SO</th>
              <th style={th}>DETAIL</th>
              <th style={th}>FLAT/3D</th>
              <th style={th}>ORDER QTY</th>
              <th style={th}>INSPECTED</th>
              <th style={th}>REJECTED</th>
              <th style={th}>SHIPPED</th>
              <th style={th}>NOTES</th>
              <th style={th}></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r: any) => (
              <tr key={r.id}>
                <td style={td}>{r.entryTs ?? ""}</td>
                <td style={td}>{r.name ?? ""}</td>
                <td style={td}>{r.salesOrderNumber ?? ""}</td>
                <td style={td}>{r.detailNumber ?? ""}</td>
                <td style={td}>{r.flatOr3d ?? ""}</td>
                <td style={td}>{r.orderQuantity ?? ""}</td>
                <td style={td}>{r.inspectedQuantity ?? ""}</td>
                <td style={td}>{r.rejectedQuantity ?? ""}</td>
                <td style={td}>{r.quantityShipped ?? ""}</td>
                <td style={{ ...td, whiteSpace: "normal" }}>{r.notes ?? ""}</td>
                <td style={td}>
                  <Link href={`/qc-daily-production/${r.id}`}>Edit</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

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
