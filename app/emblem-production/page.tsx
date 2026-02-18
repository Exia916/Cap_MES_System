"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Row = {
  id: string;
  entry_ts_display: string; // ✅ from API
  entry_date: string;       // YYYY-MM-DD
  sales_order: string | null;
  name: string;
  employee_number: number | null;
  line_count: number;
  total_pieces: number;
  notes: string | null;
};

export default function EmblemProductionListPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch("/api/emblem-production-submission-list", {
          cache: "no-store",
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Failed to load");

        setRows(data.rows ?? []);
      } catch (e: any) {
        setError(e.message || "Load error");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Emblem Production</h1>
        <Link className="rounded bg-black px-3 py-2 text-white text-sm" href="/emblem-production/add">
          + Add
        </Link>
      </div>

      {loading && <div>Loading…</div>}
      {error && <div className="text-red-600 text-sm">{error}</div>}

      {!loading && !error && (
        <div className="overflow-x-auto rounded border">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-2">DATE / TIME</th>
                <th className="text-left p-2">SO</th>
                <th className="text-left p-2">NAME</th>
                <th className="text-left p-2">LINES</th>
                <th className="text-left p-2">TOTAL PIECES</th>
                <th className="text-left p-2">NOTES</th>
                <th className="text-left p-2">ACTIONS</th>
              </tr>
            </thead>

            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="p-2">{r.entry_ts_display}</td>
                  <td className="p-2">{r.sales_order ?? ""}</td>
                  <td className="p-2">{r.name}</td>
                  <td className="p-2">{r.line_count}</td>
                  <td className="p-2">{r.total_pieces}</td>
                  <td className="p-2">{r.notes ?? ""}</td>
                  <td className="p-2">
                    <Link className="rounded border px-2 py-1" href={`/emblem-production/${r.id}`}>
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}

              {rows.length === 0 && (
                <tr>
                  <td className="p-3 text-gray-500" colSpan={7}>
                    No submissions found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
