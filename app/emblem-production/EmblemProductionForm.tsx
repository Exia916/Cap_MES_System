"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Line = {
  detailNumber: string;
  emblemType: string;
  logoName: string;
  pieces: string;
  notes: string;
};

function blankLine(): Line {
  return { detailNumber: "", emblemType: "", logoName: "", pieces: "", notes: "" };
}

/**
 * Returns YYYY-MM-DD for "today" in America/Chicago
 * (Central Time, including DST automatically).
 */
function centralTodayISODate(): string {
  const now = new Date();

  // Get "today" components in Central time
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const yyyy = parts.find((p) => p.type === "year")?.value ?? "";
  const mm = parts.find((p) => p.type === "month")?.value ?? "";
  const dd = parts.find((p) => p.type === "day")?.value ?? "";

  return `${yyyy}-${mm}-${dd}`;
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

  // ✅ keep entryDate as internal state, but HIDE it from the UI.
  // For add: default to Central "today"
  const [entryDate, setEntryDate] = useState(mode === "add" ? centralTodayISODate() : "");

  const [salesOrder, setSalesOrder] = useState("");
  const [headerNotes, setHeaderNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([blankLine()]);

  // ✅ success banner like QC
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // emblem types dropdown
  const [emblemTypes, setEmblemTypes] = useState<string[]>([]);
  const [typesLoading, setTypesLoading] = useState(false);

  // Load emblem types
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setTypesLoading(true);
        const res = await fetch("/api/emblem-types", { cache: "no-store" });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Failed to load emblem types");
        if (!cancelled) setEmblemTypes(data.types ?? []);
      } catch {
        // keep usable even if types fail
      } finally {
        if (!cancelled) setTypesLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Load edit payload
  useEffect(() => {
    if (mode !== "edit" || !id) return;

    (async () => {
      try {
        setLoading(true);
        setError(null);
        setSuccessMsg(null);

        const res = await fetch(`/api/emblem-production-submissions?id=${encodeURIComponent(id)}`, {
          cache: "no-store",
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Failed to load submission");

        // ✅ keep original entry date (hidden)
        // Expecting YYYY-MM-DD from API; if not, we defensively slice.
        const rawEntryDate = data.header?.entry_date ?? "";
        const safeEntryDate =
          typeof rawEntryDate === "string" && rawEntryDate.includes("T")
            ? rawEntryDate.slice(0, 10)
            : rawEntryDate;

        setEntryDate(safeEntryDate);
        setSalesOrder(data.header?.sales_order ?? "");
        setHeaderNotes(data.header?.notes ?? "");

        const mapped: Line[] = (data.lines ?? []).map((l: any) => ({
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

  const totalPieces = useMemo(() => {
    return lines.reduce((sum, l) => sum + (Number(l.pieces) || 0), 0);
  }, [lines]);

  function validate() {
    // entryDate is hidden, but still required for payload
    if (!entryDate) return "Entry Date is required";
    if (!salesOrder.trim()) return "Sales Order is required";
    if (!lines.length) return "At least one line is required";

    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (!l.pieces?.trim()) return `Line ${i + 1}: Pieces is required`;

      const piecesNum = Number(l.pieces);
      if (!Number.isFinite(piecesNum)) return `Line ${i + 1}: Pieces must be a number`;
      if (piecesNum < 0) return `Line ${i + 1}: Pieces cannot be negative`;
    }

    return null;
  }

  function resetForNewAdd() {
    // ✅ reset to Central "today"
    setEntryDate(centralTodayISODate());
    setSalesOrder("");
    setHeaderNotes("");
    setLines([blankLine()]);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const v = validate();
      if (v) throw new Error(v);

      const payload: any = {
        entryDate, // ✅ hidden but still submitted
        salesOrder,
        headerNotes,
        lines: lines.map((l) => ({
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

      if (mode === "add") {
        setSuccessMsg(`Saved ${lines.length} line(s).`);
        resetForNewAdd();
        router.refresh();
      } else {
        router.push("/emblem-production");
        router.refresh();
      }
    } catch (e: any) {
      setError(e.message || "Save error");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="p-6">Loading…</div>;

  return (
    <form onSubmit={onSubmit} className="max-w-4xl mx-auto space-y-4">
      {error && (
        <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {successMsg && (
        <div className="rounded border border-green-300 bg-green-50 p-3 text-sm text-green-800">
          {successMsg}
        </div>
      )}

      {/* ✅ Entry Date is intentionally hidden to match other sections */}

      <div>
        <label className="block text-sm font-medium mb-1">Sales Order</label>
        <input
          className="w-full rounded border p-2"
          value={salesOrder}
          onChange={(e) => setSalesOrder(e.target.value)}
          placeholder="1234567"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Header Notes</label>
        <input
          className="w-full rounded border p-2"
          value={headerNotes}
          onChange={(e) => setHeaderNotes(e.target.value)}
          placeholder="Optional"
        />
      </div>

      <div className="rounded border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="font-medium">Lines</div>
          <button type="button" onClick={addLine} className="rounded border px-3 py-1.5 text-sm">
            + Add Line
          </button>
        </div>

        {lines.map((line, idx) => (
          <div key={idx} className="rounded border p-3 space-y-3">
            <div className="flex items-center justify-between">
              <div className="font-medium">Line {idx + 1}</div>
              <button
                type="button"
                onClick={() => removeLine(idx)}
                className="rounded border px-3 py-1.5 text-sm"
                disabled={lines.length === 1}
              >
                Remove
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
              <div>
                <label className="block text-sm font-medium mb-1">Detail #</label>
                <input
                  className="w-full rounded border p-2"
                  value={line.detailNumber}
                  onChange={(e) => updateLine(idx, { detailNumber: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Emblem Type</label>
                <select
                  className="w-full rounded border p-2"
                  value={line.emblemType}
                  onChange={(e) => updateLine(idx, { emblemType: e.target.value })}
                >
                  <option value="">{typesLoading ? "Loading..." : "Select emblem type"}</option>
                  {emblemTypes.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Logo Name</label>
                <input
                  className="w-full rounded border p-2"
                  value={line.logoName}
                  onChange={(e) => updateLine(idx, { logoName: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Pieces</label>
                <input
                  type="number"
                  className="w-full rounded border p-2"
                  value={line.pieces}
                  onChange={(e) => updateLine(idx, { pieces: e.target.value })}
                  min={0}
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Line Notes</label>
              <input
                className="w-full rounded border p-2"
                value={line.notes}
                onChange={(e) => updateLine(idx, { notes: e.target.value })}
                placeholder="Optional"
              />
            </div>
          </div>
        ))}

        <div className="text-sm text-gray-600">Total Pieces: {totalPieces}</div>
      </div>

      <button type="submit" disabled={saving} className="rounded bg-black px-4 py-2 text-white disabled:opacity-60">
        {saving ? "Saving..." : "Save"}
      </button>
    </form>
  );
}
