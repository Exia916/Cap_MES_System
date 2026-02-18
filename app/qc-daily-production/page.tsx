"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

function getDefaultYYYYMMDD(): string {
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

type Row = {
  id: string;
  entryTs: string;
  name: string;
  employeeNumber: number;
  salesOrder: number | null;
  lineCount: number;
  notes: string | null;
};

export default function QCDailyProductionPage() {
  const [entryDate, setEntryDate] = useState(() => getDefaultYYYYMMDD());
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load(date: string) {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/qc-daily-production-submission-list?entryDate=${encodeURIComponent(date)}`,
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
    load(entryDate);
  }, [entryDate]);

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ margin: 0 }}>QC Daily Production</h1>
        <Link href="/qc-daily-production/add">Add Entry</Link>
      </div>

      <div style={{ marginTop: 12 }}>
        <label>
          Entry Date:{" "}
          <input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} />
        </label>
      </div>

      {loading && <p>Loading…</p>}
      {error && <p style={{ color: "crimson" }}>{error}</p>}
      {!loading && !error && rows.length === 0 && <p>No submissions found.</p>}

      {!loading && !error && rows.length > 0 && (
        <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 16 }}>
          <thead>
            <tr>
              <th style={th}>DATE / TIME</th>
              <th style={th}>NAME</th>
              <th style={th}>SO</th>
              <th style={th}>LINES</th>
              <th style={th}>NOTES</th>
              <th style={th}></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td style={td}>{r.entryTs}</td>
                <td style={td}>{r.name}</td>
                <td style={td}>{r.salesOrder ?? ""}</td>
                <td style={td}>{r.lineCount}</td>
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
