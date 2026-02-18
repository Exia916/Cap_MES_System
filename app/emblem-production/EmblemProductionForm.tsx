"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Line = {
  salesOrder: string;
  detailNumber: string;
  emblemType: string;
  logoName: string;
  pieces: string;
  notes: string;
};

function blankLine(): Line {
  return {
    salesOrder: "",
    detailNumber: "",
    emblemType: "",
    logoName: "",
    pieces: "",
    notes: "",
  };
}

export default function EmblemProductionForm({
  mode,
  id,
}: {
  mode: "add" | "edit";
  id?: string;
}) {
  const router = useRouter();

  const [loading, setLoading] = useState(mode === "edit");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [entryDate, setEntryDate] = useState("");
  const [headerNotes, setHeaderNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([blankLine()]);

  // Auto-populate on edit
  useEffect(() => {
    if (mode !== "edit" || !id) return;

    (async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(`/api/emblem-production-submissions?id=${encodeURIComponent(id)}`, {
          cache: "no-store",
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Failed to load submission");

        setEntryDate(data.header?.entry_date ?? "");
        setHeaderNotes(data.header?.notes ?? "");

        const mapped: Line[] = (data.lines ?? []).map((l: any) => ({
          salesOrder: l.sales_order ?? "",
          detailNumber: l.detail_number?.toString?.() ?? "",
          emblemType: l.emblem_type ?? "",
          logoName: l.logo_name ?? "",
          pieces: l.pieces?.toString?.() ?? "",
          notes: l.line_notes ?? "",
        }));

        setLines(mapped.length ? mapped : [blankLine()]);
      } catch (e: any) {
        setError(e.message || "Error loading submission");
      } finally {
        setLoading(false);
      }
    })();
  }, [mode, id]);

  function updateLine(index: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }

  function addLine() {
    setLines((prev) => [...prev, blankLine()]);
  }

  function removeLine(index: number) {
    setLines((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== index)));
  }

  function validate() {
    if (!entryDate) return "Entry Date is required";

    if (!lines.length) return "At least one line is required";

    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (!l.salesOrder?.trim()) return `Line ${i + 1}: Sales Order is required`;
      if (!l.pieces?.trim()) return `Line ${i + 1}: Pieces is required`;

      const piecesNum = Number(l.pieces);
      if (!Number.isFinite(piecesNum)) return `Line ${i + 1}: Pieces must be a number`;
      if (piecesNum < 0) return `Line ${i + 1}: Pieces cannot be negative`;
    }

    return null;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const v = validate();
      if (v) throw new Error(v);

      const payload: any = {
        entryDate,
        headerNotes,
        lines: lines.map((l) => ({
          salesOrder: l.salesOrder,
          detailNumber: l.detailNumber,
          emblemType: l.emblemType,
          logoName: l.logoName,
          pieces: l.pieces,
          notes: l.notes,
        })),
      };

      const url = mode === "add" ? "/api/emblem-production-submission" : "/api/emblem-production-update";
      if (mode === "edit") payload.id = id;

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Save failed");

      router.push("/emblem-production");
      router.refresh();
    } catch (e: any) {
      setError(e.message || "Save error");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="p-6">Loading…</div>;

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {error && (
        <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="block text-sm font-medium mb-1">Entry Date</label>
          <input
            type="date"
            className="w-full rounded border p-2"
            value={entryDate}
            onChange={(e) => setEntryDate(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Header Notes</label>
          <input
            type="text"
            className="w-full rounded border p-2"
            value={headerNotes}
            onChange={(e) => setHeaderNotes(e.target.value)}
            placeholder="Optional"
          />
        </div>
      </div>

      <div className="rounded border p-3 space-y-3">
        <div className="flex items-center justify-between">
          <div className="font-medium">Lines</div>
          <button
            type="button"
            onClick={addLine}
            className="rounded bg-black px-3 py-1.5 text-white text-sm"
          >
            + Add Line
          </button>
        </div>

        {lines.map((line, idx) => (
          <div key={idx} className="grid grid-cols-1 gap-3 md:grid-cols-6 border-t pt-3">
            <div>
              <label className="block text-xs font-medium mb-1">Sales Order</label>
              <input
                className="w-full rounded border p-2"
                value={line.salesOrder}
                onChange={(e) => updateLine(idx, { salesOrder: e.target.value })}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1">Detail #</label>
              <input
                className="w-full rounded border p-2"
                value={line.detailNumber}
                onChange={(e) => updateLine(idx, { detailNumber: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1">Emblem Type</label>
              <input
                className="w-full rounded border p-2"
                value={line.emblemType}
                onChange={(e) => updateLine(idx, { emblemType: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1">Logo Name</label>
              <input
                className="w-full rounded border p-2"
                value={line.logoName}
                onChange={(e) => updateLine(idx, { logoName: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1">Pieces</label>
              <input
                type="number"
                className="w-full rounded border p-2"
                value={line.pieces}
                onChange={(e) => updateLine(idx, { pieces: e.target.value })}
                required
                min={0}
              />
            </div>

            <div className="flex items-end gap-2">
              <div className="flex-1">
                <label className="block text-xs font-medium mb-1">Line Notes</label>
                <input
                  className="w-full rounded border p-2"
                  value={line.notes}
                  onChange={(e) => updateLine(idx, { notes: e.target.value })}
                />
              </div>

              <button
                type="button"
                onClick={() => removeLine(idx)}
                className="rounded border px-3 py-2 text-sm"
                disabled={lines.length === 1}
                title={lines.length === 1 ? "Must have at least one line" : "Remove line"}
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>

      <button
        type="submit"
        disabled={saving}
        className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-60"
      >
        {saving ? "Saving..." : mode === "add" ? "Submit" : "Update"}
      </button>
    </form>
  );
}
