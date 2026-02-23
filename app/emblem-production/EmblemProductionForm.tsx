"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

/** ✅ remove commas helper (matches your other pages) */
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

/** --- Field level errors --- */
type LineFieldErrors = {
  detailNumber?: string;
  emblemType?: string;
  pieces?: string;
};

type FormErrors = {
  salesOrder?: string;
  lines?: LineFieldErrors[];
};

function hasErrors(e: FormErrors) {
  if (e.salesOrder) return true;
  if (e.lines && e.lines.some((x) => Object.keys(x).length > 0)) return true;
  return false;
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

  // ✅ server/runtime errors only (not validation)
  const [error, setError] = useState<string | null>(null);

  // ✅ field-level errors (validation)
  const [fieldErrors, setFieldErrors] = useState<FormErrors>({});

  // ✅ keep entryDate as internal state, but HIDE it from the UI.
  const [entryDate, setEntryDate] = useState(mode === "add" ? centralTodayISODate() : "");

  const [salesOrder, setSalesOrder] = useState("");
  const [headerNotes, setHeaderNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([blankLine()]);

  // ✅ success banner like QC
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // emblem types dropdown (KEEP SAME CALL)
  const [emblemTypes, setEmblemTypes] = useState<string[]>([]);
  const [typesLoading, setTypesLoading] = useState(false);

  // --- Refs for auto-scroll/focus ---
  const salesOrderRef = useRef<HTMLInputElement | null>(null);
  const detailRefs = useRef<(HTMLInputElement | null)[]>([]);
  const emblemTypeRefs = useRef<(HTMLSelectElement | null)[]>([]);
  const piecesRefs = useRef<(HTMLInputElement | null)[]>([]);

  // styling (matches your other forms)
  const errTextClass = "mt-1 text-xs font-semibold text-red-700";
  const inputBaseClass = "w-full rounded border p-2";
  const inputErrorClass = "border-red-500 ring-2 ring-red-200";

  function inputClass(hasErr?: boolean) {
    return `${inputBaseClass} ${hasErr ? inputErrorClass : ""}`;
  }

  // Load emblem types (KEEP SAME CALL)
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

  // Load edit payload (KEEP SAME CALL)
  useEffect(() => {
    if (mode !== "edit" || !id) return;

    (async () => {
      try {
        setLoading(true);
        setError(null);
        setSuccessMsg(null);
        setFieldErrors({});

        const res = await fetch(`/api/emblem-production-submissions?id=${encodeURIComponent(id)}`, {
          cache: "no-store",
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Failed to load submission");

        // ✅ keep original entry date (hidden)
        const rawEntryDate = data.header?.entry_date ?? "";
        const safeEntryDate =
          typeof rawEntryDate === "string" && rawEntryDate.includes("T") ? rawEntryDate.slice(0, 10) : rawEntryDate;

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
    setFieldErrors((prev) => ({
      ...prev,
      lines: prev.lines ? [...prev.lines, {}] : prev.lines,
    }));
  }

  function removeLine(index: number) {
    setLines((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== index)));
    setFieldErrors((prev) => {
      if (!prev.lines) return prev;
      return { ...prev, lines: prev.lines.filter((_, i) => i !== index) };
    });

    // keep refs aligned
    detailRefs.current.splice(index, 1);
    emblemTypeRefs.current.splice(index, 1);
    piecesRefs.current.splice(index, 1);
  }

  const totalPieces = useMemo(() => {
    return lines.reduce((sum, l) => sum + (Number(stripCommas(l.pieces)) || 0), 0);
  }, [lines]);

  function clearSalesOrderError() {
    setFieldErrors((prev) => ({ ...prev, salesOrder: undefined }));
  }

  function clearLineFieldError(index: number, field: keyof LineFieldErrors) {
    setFieldErrors((prev) => {
      if (!prev.lines) return prev;
      const nextLines = [...prev.lines];
      const cur = nextLines[index] ?? {};
      nextLines[index] = { ...cur, [field]: undefined };
      return { ...prev, lines: nextLines };
    });
  }

  function validateClient(): FormErrors {
    const next: FormErrors = {};

    // entryDate is hidden but required
    if (!entryDate) {
      // don't show a field error since it is hidden; surface as server-style error if it ever happens
    }

    const so = stripCommas(salesOrder).trim();
    if (!so) next.salesOrder = "Sales Order is required.";
    else if (!isSevenDigits(so)) next.salesOrder = "Sales Order must be exactly 7 digits (numbers only).";

    if (!lines.length) {
      next.lines = [];
      return next;
    }

    const lineErrors: LineFieldErrors[] = lines.map((l) => {
      const le: LineFieldErrors = {};

      const dn = stripCommas(l.detailNumber).trim();
      if (!dn) le.detailNumber = "Detail # is required.";
      else if (!isWholeNumber(dn)) le.detailNumber = "Detail # must be a whole number.";

      const et = String(l.emblemType ?? "").trim();
      if (!et) le.emblemType = "Emblem Type is required.";

      const pcs = stripCommas(l.pieces).trim();
      if (!pcs) le.pieces = "Pieces is required.";
      else if (!isWholeNumber(pcs)) le.pieces = "Pieces must be a whole number.";
      else if (Number(pcs) < 0) le.pieces = "Pieces cannot be negative.";

      return le;
    });

    if (lineErrors.some((le) => Object.keys(le).length > 0)) next.lines = lineErrors;

    return next;
  }

  function scrollToFirstError(v: FormErrors) {
    if (v.salesOrder && salesOrderRef.current) {
      salesOrderRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
      salesOrderRef.current.focus();
      return;
    }

    if (v.lines) {
      for (let i = 0; i < v.lines.length; i++) {
        const le = v.lines[i];
        if (!le) continue;

        if (le.detailNumber && detailRefs.current[i]) {
          detailRefs.current[i]!.scrollIntoView({ behavior: "smooth", block: "center" });
          detailRefs.current[i]!.focus();
          return;
        }

        if (le.emblemType && emblemTypeRefs.current[i]) {
          emblemTypeRefs.current[i]!.scrollIntoView({ behavior: "smooth", block: "center" });
          emblemTypeRefs.current[i]!.focus();
          return;
        }

        if (le.pieces && piecesRefs.current[i]) {
          piecesRefs.current[i]!.scrollIntoView({ behavior: "smooth", block: "center" });
          piecesRefs.current[i]!.focus();
          return;
        }
      }
    }
  }

  function resetForNewAdd() {
    setEntryDate(centralTodayISODate());
    setSalesOrder("");
    setHeaderNotes("");
    setLines([blankLine()]);
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
        // entryDate is hidden; if missing, show a generic error at top
        if (!entryDate) setError("Entry Date is required.");
        setTimeout(() => scrollToFirstError(v), 50);
        return;
      }

      // KEEP SAME payload & endpoints
      const payload: any = {
        entryDate, // hidden but submitted
        salesOrder: stripCommas(salesOrder),
        headerNotes,
        lines: lines.map((l) => ({
          detailNumber: stripCommas(l.detailNumber),
          emblemType: l.emblemType,
          logoName: l.logoName,
          pieces: stripCommas(l.pieces),
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
      {/* server/runtime errors only */}
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

      {/* Entry Date intentionally hidden */}

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
            clearSalesOrderError();
          }}
          placeholder="1234567"
          inputMode="numeric"
          readOnly={mode === "edit"} // match your other modules (prevents SO changes on edit)
        />
        {fieldErrors.salesOrder ? <div className={errTextClass}>{fieldErrors.salesOrder}</div> : null}
        <div className="mt-1 text-xs opacity-70">Is required, and has to be a 7 digit number.</div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Header Notes</label>
        <input
          className={inputClass(false)}
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

        {lines.map((line, idx) => {
          const le = fieldErrors.lines?.[idx] ?? {};
          return (
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
                  <label className="block text-sm font-medium mb-1">
                    Detail # <span className="text-red-600">*</span>
                  </label>
                  <input
                    ref={(el) => {
                      detailRefs.current[idx] = el;
                    }}
                    className={inputClass(!!le.detailNumber)}
                    value={line.detailNumber}
                    onChange={(e) => {
                      updateLine(idx, { detailNumber: stripCommas(e.target.value) });
                      clearLineFieldError(idx, "detailNumber");
                    }}
                    inputMode="numeric"
                  />
                  {le.detailNumber ? <div className={errTextClass}>{le.detailNumber}</div> : null}
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Emblem Type <span className="text-red-600">*</span>
                  </label>
                  <select
                    ref={(el) => {
                      emblemTypeRefs.current[idx] = el;
                    }}
                    className={inputClass(!!le.emblemType)}
                    value={line.emblemType}
                    onChange={(e) => {
                      updateLine(idx, { emblemType: e.target.value });
                      clearLineFieldError(idx, "emblemType");
                    }}
                  >
                    <option value="">{typesLoading ? "Loading..." : "Select emblem type"}</option>
                    {emblemTypes.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                  {le.emblemType ? <div className={errTextClass}>{le.emblemType}</div> : null}
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Logo Name</label>
                  <input
                    className={inputClass(false)}
                    value={line.logoName}
                    onChange={(e) => updateLine(idx, { logoName: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Pieces <span className="text-red-600">*</span>
                  </label>
                  <input
                    ref={(el) => {
                      piecesRefs.current[idx] = el;
                    }}
                    type="text"
                    className={inputClass(!!le.pieces)}
                    value={line.pieces}
                    onChange={(e) => {
                      updateLine(idx, { pieces: stripCommas(e.target.value) });
                      clearLineFieldError(idx, "pieces");
                    }}
                    inputMode="numeric"
                  />
                  {le.pieces ? <div className={errTextClass}>{le.pieces}</div> : null}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Line Notes</label>
                <input
                  className={inputClass(false)}
                  value={line.notes}
                  onChange={(e) => updateLine(idx, { notes: e.target.value })}
                  placeholder="Optional"
                />
              </div>
            </div>
          );
        })}

        <div className="text-sm text-gray-600">Total Pieces: {totalPieces}</div>
      </div>

      <button type="submit" disabled={saving} className="rounded bg-black px-4 py-2 text-white disabled:opacity-60">
        {saving ? "Saving..." : mode === "edit" ? "Update" : "Save"}
      </button>
    </form>
  );
}