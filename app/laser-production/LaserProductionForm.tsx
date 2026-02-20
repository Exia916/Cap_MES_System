"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

function centralTodayISODate(): string {
  const now = new Date();
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

export default function LaserProductionForm({
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
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Hidden date (kept for DB)
  const [entryDate, setEntryDate] = useState(mode === "add" ? centralTodayISODate() : "");

  const [salesOrder, setSalesOrder] = useState("");
  const [leatherStyleColor, setLeatherStyleColor] = useState("");
  const [piecesCut, setPiecesCut] = useState("");
  const [notes, setNotes] = useState("");

  const [styles, setStyles] = useState<string[]>([]);
  const [stylesLoading, setStylesLoading] = useState(false);

  // Load dropdown options
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setStylesLoading(true);
        const res = await fetch("/api/leather-styles", { cache: "no-store" });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Failed to load leather styles");
        if (!cancelled) setStyles(data.styles ?? []);
      } catch {
        // keep usable
      } finally {
        if (!cancelled) setStylesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Load edit record
  useEffect(() => {
    if (mode !== "edit" || !id) return;

    (async () => {
      try {
        setLoading(true);
        setError(null);
        setSuccessMsg(null);

        const res = await fetch(`/api/laser-production-entry?id=${encodeURIComponent(id)}`, {
          cache: "no-store",
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Failed to load entry");

        const rawDate = data.row?.entry_date ?? "";
        setEntryDate(typeof rawDate === "string" && rawDate.includes("T") ? rawDate.slice(0, 10) : rawDate);

        setSalesOrder(data.row?.sales_order ?? "");
        setLeatherStyleColor(data.row?.leather_style_color ?? "");
        setPiecesCut(data.row?.pieces_cut?.toString?.() ?? "");
        setNotes(data.row?.notes ?? "");
      } catch (e: any) {
        setError(e.message || "Error loading entry");
      } finally {
        setLoading(false);
      }
    })();
  }, [mode, id]);

  function validate() {
    if (!salesOrder.trim()) return "Sales Order is required";
    if (!leatherStyleColor.trim()) return "Leather Style/Color is required";

    const so = Number(salesOrder);
    if (!Number.isFinite(so)) return "Sales Order must be a number";

    const pieces = Number(piecesCut);
    if (!piecesCut.trim()) return "Pieces Cut is required";
    if (!Number.isFinite(pieces) || pieces < 0) return "Pieces Cut must be a non-negative number";

    return null;
  }

  function resetForNewAdd() {
    setEntryDate(centralTodayISODate());
    setSalesOrder("");
    setLeatherStyleColor("");
    setPiecesCut("");
    setNotes("");
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
        entryDate,
        salesOrder,
        leatherStyleColor,
        piecesCut,
        notes,
      };

      let url = "/api/laser-production-add";
      if (mode === "edit") {
        url = "/api/laser-production-update";
        payload.id = id;
      }

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Save failed");

      if (mode === "add") {
        setSuccessMsg("Saved entry.");
        resetForNewAdd();
        router.refresh();
      } else {
        router.push("/laser-production");
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
    <form onSubmit={onSubmit} className="max-w-3xl mx-auto space-y-4">
      {error && (
        <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      {successMsg && (
        <div className="rounded border border-green-300 bg-green-50 p-3 text-sm text-green-800">
          {successMsg}
        </div>
      )}

      {/* Entry Date hidden to match other modules */}

      <div>
        <label className="block text-sm font-medium mb-1">Sales Order</label>
        <input
          className="w-full rounded border p-2"
          value={salesOrder}
          onChange={(e) => setSalesOrder(e.target.value)}
          placeholder="7-digit SO"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Leather Style/Color</label>
        <select
          className="w-full rounded border p-2"
          value={leatherStyleColor}
          onChange={(e) => setLeatherStyleColor(e.target.value)}
          required
        >
          <option value="">{stylesLoading ? "Loading..." : "Select Style/Color"}</option>
          {styles.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Pieces Cut</label>
        <input
          type="number"
          className="w-full rounded border p-2"
          value={piecesCut}
          onChange={(e) => setPiecesCut(e.target.value)}
          min={0}
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Notes</label>
        <textarea
          className="w-full rounded border p-2"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          placeholder="Optional"
        />
      </div>

      <button
        type="submit"
        disabled={saving}
        className="rounded bg-black px-4 py-2 text-white disabled:opacity-60"
      >
        {saving ? "Saving..." : "Save"}
      </button>
    </form>
  );
}
