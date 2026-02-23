"use client";

import { useEffect, useState, useRef } from "react";
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

// ✅ remove commas helper
function stripCommas(v: any) {
  const s = v === null || v === undefined ? "" : String(v);
  return s.replace(/,/g, "");
}

function isSevenDigits(v: any) {
  const s = stripCommas(v).trim();
  return /^\d{7}$/.test(s);
}

function isWholeNumber(v: any) {
  const s = stripCommas(v).trim();
  return /^\d+$/.test(s);
}

type FieldErrors = {
  salesOrder?: string;
  leatherStyleColor?: string;
  piecesCut?: string;
};

function hasErrors(e: FieldErrors) {
  return !!(e.salesOrder || e.leatherStyleColor || e.piecesCut);
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

  // server/runtime errors only
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // field-level errors
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  // Hidden date (kept for DB)
  const [entryDate, setEntryDate] = useState(mode === "add" ? centralTodayISODate() : "");

  const [salesOrder, setSalesOrder] = useState("");
  const [leatherStyleColor, setLeatherStyleColor] = useState("");
  const [piecesCut, setPiecesCut] = useState("");
  const [notes, setNotes] = useState("");

  const [styles, setStyles] = useState<string[]>([]);
  const [stylesLoading, setStylesLoading] = useState(false);

  // refs for auto-scroll/focus
  const salesOrderRef = useRef<HTMLInputElement | null>(null);
  const styleRef = useRef<HTMLSelectElement | null>(null);
  const piecesRef = useRef<HTMLInputElement | null>(null);

  // styling
  const errTextClass = "mt-1 text-xs font-semibold text-red-700";
  const inputBaseClass = "w-full rounded border p-2";
  const inputErrorClass = "border-red-500 ring-2 ring-red-200";
  function inputClass(hasErr?: boolean) {
    return `${inputBaseClass} ${hasErr ? inputErrorClass : ""}`;
  }

  // Load dropdown options (KEEP SAME CALL)
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

  // Load edit record (KEEP SAME CALL)
  useEffect(() => {
    if (mode !== "edit" || !id) return;

    (async () => {
      try {
        setLoading(true);
        setError(null);
        setSuccessMsg(null);
        setFieldErrors({});

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

  function validateClient(): FieldErrors {
    const next: FieldErrors = {};

    const so = stripCommas(salesOrder).trim();
    if (!so) next.salesOrder = "Sales Order is required.";
    else if (!isSevenDigits(so)) next.salesOrder = "Sales Order must be exactly 7 digits (numbers only).";

    if (!String(leatherStyleColor ?? "").trim()) {
      next.leatherStyleColor = "Leather Style/Color is required.";
    }

    const pcs = stripCommas(piecesCut).trim();
    if (!pcs) next.piecesCut = "Pieces Cut is required.";
    else if (!isWholeNumber(pcs)) next.piecesCut = "Pieces Cut must be a whole number.";
    else if (Number(pcs) < 0) next.piecesCut = "Pieces Cut cannot be negative.";

    return next;
  }

  function scrollToFirstError(v: FieldErrors) {
    if (v.salesOrder && salesOrderRef.current) {
      salesOrderRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
      salesOrderRef.current.focus();
      return;
    }
    if (v.leatherStyleColor && styleRef.current) {
      styleRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
      styleRef.current.focus();
      return;
    }
    if (v.piecesCut && piecesRef.current) {
      piecesRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
      piecesRef.current.focus();
      return;
    }
  }

  function resetForNewAdd() {
    setEntryDate(centralTodayISODate());
    setSalesOrder("");
    setLeatherStyleColor("");
    setPiecesCut("");
    setNotes("");
    setFieldErrors({});
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const v = validateClient();
      setFieldErrors(v);

      if (hasErrors(v) || !entryDate) {
        if (!entryDate) setError("Entry Date is required.");
        setTimeout(() => scrollToFirstError(v), 50);
        return;
      }

      // KEEP SAME payload and endpoints
      const payload: any = {
        entryDate,
        salesOrder: stripCommas(salesOrder),
        leatherStyleColor,
        piecesCut: stripCommas(piecesCut),
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
        <label className="block text-sm font-medium mb-1">
          Sales Order <span className="text-red-600">*</span>
        </label>
        <input
          ref={salesOrderRef}
          className={inputClass(!!fieldErrors.salesOrder)}
          value={salesOrder}
          onChange={(e) => {
            setSalesOrder(stripCommas(e.target.value));
            setFieldErrors((prev) => ({ ...prev, salesOrder: undefined }));
          }}
          placeholder="7-digit SO"
          inputMode="numeric"
          readOnly={mode === "edit"} // match other modules
        />
        {fieldErrors.salesOrder ? <div className={errTextClass}>{fieldErrors.salesOrder}</div> : null}
        <div className="mt-1 text-xs opacity-70">Is required, and has to be a 7 digit number.</div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">
          Leather Style/Color <span className="text-red-600">*</span>
        </label>
        <select
          ref={styleRef}
          className={inputClass(!!fieldErrors.leatherStyleColor)}
          value={leatherStyleColor}
          onChange={(e) => {
            setLeatherStyleColor(e.target.value);
            setFieldErrors((prev) => ({ ...prev, leatherStyleColor: undefined }));
          }}
        >
          <option value="">{stylesLoading ? "Loading..." : "Select Style/Color"}</option>
          {styles.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        {fieldErrors.leatherStyleColor ? <div className={errTextClass}>{fieldErrors.leatherStyleColor}</div> : null}
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">
          Pieces Cut <span className="text-red-600">*</span>
        </label>
        <input
          ref={piecesRef}
          type="text"
          className={inputClass(!!fieldErrors.piecesCut)}
          value={piecesCut}
          onChange={(e) => {
            setPiecesCut(stripCommas(e.target.value));
            setFieldErrors((prev) => ({ ...prev, piecesCut: undefined }));
          }}
          inputMode="numeric"
          placeholder=""
        />
        {fieldErrors.piecesCut ? <div className={errTextClass}>{fieldErrors.piecesCut}</div> : null}
        <div className="mt-1 text-xs opacity-70">Is required, and should be a number only.</div>
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

      <button type="submit" disabled={saving} className="rounded bg-black px-4 py-2 text-white disabled:opacity-60">
        {saving ? "Saving..." : mode === "edit" ? "Update" : "Save"}
      </button>
    </form>
  );
}
