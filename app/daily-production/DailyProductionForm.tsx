"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

type LocationOption = { value: string; label: string };
type MachineOption = { value: string; label: string };

type Line = {
  detailNumber: string;
  embroideryLocation: string;
  stitches: string;
  pieces: string;
  is3d: boolean;
  isKnit: boolean;
  detailComplete: boolean;
  notes: string;
};

function blankLine(): Line {
  return {
    detailNumber: "",
    embroideryLocation: "",
    stitches: "",
    pieces: "",
    is3d: false,
    isKnit: false,
    detailComplete: false,
    notes: "",
  };
}

type DailyProductionFormProps = {
  initialSubmissionId?: string;
};

type LineFieldErrors = {
  detailNumber?: string;
  embroideryLocation?: string;
  stitches?: string;
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

function isWholeNumberString(v: string) {
  const s = String(v ?? "").trim();
  if (!s) return false;
  if (!/^\d+$/.test(s)) return false;
  const n = Number(s);
  return Number.isFinite(n) && Number.isInteger(n);
}

function isSevenDigitSalesOrder(v: string) {
  const s = String(v ?? "").trim();
  return /^\d{7}$/.test(s);
}

const MACHINE_STORAGE_KEY = "capmes.dailyProduction.machineNumber";

export default function DailyProductionForm({ initialSubmissionId }: DailyProductionFormProps) {
  const router = useRouter();
  const pathname = usePathname();

  const [salesOrder, setSalesOrder] = useState("");
  const [machineNumber, setMachineNumber] = useState("");
  const [headerNotes, setHeaderNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([blankLine()]);

  const [locationOptions, setLocationOptions] = useState<LocationOption[]>([]);
  const [machineOptions, setMachineOptions] = useState<MachineOption[]>([]);

  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string>(initialSubmissionId ?? "");

  const [saving, setSaving] = useState(false);

  // ✅ only for REAL server/runtime errors (not validation)
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // ✅ field-level validation errors
  const [errors, setErrors] = useState<FormErrors>({});

  const canRemove = useMemo(() => lines.length > 1, [lines.length]);

  // --- Refs for auto-scroll/focus ---
  const salesOrderRef = useRef<HTMLInputElement | null>(null);
  const detailRefs = useRef<(HTMLInputElement | null)[]>([]);
  const locRefs = useRef<(HTMLSelectElement | null)[]>([]);
  const stitchesRefs = useRef<(HTMLInputElement | null)[]>([]);
  const piecesRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Styling (simple + consistent with your current look)
  const errTextClass = "mt-1 text-xs font-semibold text-red-700";
  const inputBaseClass = "mt-1 w-full rounded border px-3 py-2";
  const inputErrorClass = "border-red-500 ring-2 ring-red-200";

  function inputClass(hasErr?: boolean) {
    return `${inputBaseClass} ${hasErr ? inputErrorClass : ""}`;
  }

  // Load saved machine
  useEffect(() => {
    try {
      const saved = localStorage.getItem(MACHINE_STORAGE_KEY);
      if (saved && !machineNumber) setMachineNumber(saved);
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist machine
  useEffect(() => {
    try {
      if (machineNumber) localStorage.setItem(MACHINE_STORAGE_KEY, machineNumber);
    } catch {
      // ignore
    }
  }, [machineNumber]);

  // Load location options
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/embroidery-locations", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();

        const opts: LocationOption[] = Array.isArray(data)
          ? data
          : Array.isArray(data?.options)
            ? data.options
            : Array.isArray(data?.locations)
              ? data.locations.map((l: any) => ({
                  value: String(l.value ?? l.id ?? l.name),
                  label: String(l.label ?? l.name ?? l.value ?? l.id),
                }))
              : [];

        setLocationOptions(opts);
      } catch {
        // ignore
      }
    })();
  }, []);

  // Load machine options
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/machines", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();

        const opts: MachineOption[] = Array.isArray(data)
          ? data
          : Array.isArray(data?.options)
            ? data.options
            : Array.isArray(data?.machines)
              ? data.machines.map((m: any) => ({
                  value: String(m.value ?? m.machineNumber ?? m.id ?? m.name),
                  label: String(m.label ?? m.machineName ?? m.name ?? m.machineNumber ?? m.value ?? m.id),
                }))
              : [];

        setMachineOptions(opts);
      } catch {
        // ignore
      }
    })();
  }, []);

  function updateLine(index: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }

  function addLine() {
    setLines((prev) => [...prev, blankLine()]);
    setErrors((prev) => ({
      ...prev,
      lines: prev.lines ? [...prev.lines, {}] : prev.lines,
    }));
  }

  function removeLine(index: number) {
    setLines((prev) => prev.filter((_, i) => i !== index));
    setErrors((prev) => {
      if (!prev.lines) return prev;
      return { ...prev, lines: prev.lines.filter((_, i) => i !== index) };
    });

    // keep refs aligned
    detailRefs.current.splice(index, 1);
    locRefs.current.splice(index, 1);
    stitchesRefs.current.splice(index, 1);
    piecesRefs.current.splice(index, 1);
  }

  function validateClient(): FormErrors {
    const next: FormErrors = {};

    // ✅ Sales Order must be exactly 7 digits (clear, specific message)
    if (!salesOrder.trim()) {
      next.salesOrder = "Sales Order is required.";
    } else if (!isSevenDigitSalesOrder(salesOrder)) {
      next.salesOrder = "Sales Order must be exactly 7 digits (numbers only).";
    }

    const lineErrors: LineFieldErrors[] = lines.map((l) => {
      const le: LineFieldErrors = {};

      // ✅ Detail Number must be a whole number
      if (!String(l.detailNumber ?? "").trim()) le.detailNumber = "Detail # is required.";
      else if (!isWholeNumberString(l.detailNumber)) le.detailNumber = "Detail # must be a whole number.";

      if (!l.embroideryLocation.trim()) le.embroideryLocation = "Location is required.";

      if (!String(l.stitches ?? "").trim()) le.stitches = "Stitches is required.";
      else if (!isWholeNumberString(l.stitches)) le.stitches = "Stitches must be a whole number.";

      if (!String(l.pieces ?? "").trim()) le.pieces = "Pieces is required.";
      else if (!isWholeNumberString(l.pieces)) le.pieces = "Pieces must be a whole number.";

      return le;
    });

    if (lineErrors.some((le) => Object.keys(le).length > 0)) next.lines = lineErrors;

    return next;
  }

  function clearSalesOrderError() {
    setErrors((prev) => ({ ...prev, salesOrder: undefined }));
  }

  function clearLineFieldError(index: number, field: keyof LineFieldErrors) {
    setErrors((prev) => {
      if (!prev.lines) return prev;
      const nextLines = [...prev.lines];
      const cur = nextLines[index] ?? {};
      nextLines[index] = { ...cur, [field]: undefined };
      return { ...prev, lines: nextLines };
    });
  }

  // ✅ Auto-scroll to first invalid field
  function scrollToFirstError(v: FormErrors) {
    // priority: Sales Order → first line with error in order: detail → location → stitches → pieces
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
        if (le.embroideryLocation && locRefs.current[i]) {
          locRefs.current[i]!.scrollIntoView({ behavior: "smooth", block: "center" });
          locRefs.current[i]!.focus();
          return;
        }
        if (le.stitches && stitchesRefs.current[i]) {
          stitchesRefs.current[i]!.scrollIntoView({ behavior: "smooth", block: "center" });
          stitchesRefs.current[i]!.focus();
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

  // ✅ Load submission for edit
  async function loadSubmission(submissionId: string) {
    setServerError(null);
    setSuccessMsg(null);
    setErrors({});

    const res = await fetch(`/api/daily-production-submission?id=${encodeURIComponent(submissionId)}`, {
      cache: "no-store",
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data?.error ?? "Failed to load submission.");

    const submission = data?.submission;
    const loadedLines = Array.isArray(data?.lines) ? data.lines : [];

    if (submission?.salesOrder != null) setSalesOrder(String(submission.salesOrder));
    setHeaderNotes(submission?.notes ?? "");
    if (submission?.machineNumber != null) setMachineNumber(String(submission.machineNumber));

    setLines(
      loadedLines.length > 0
        ? loadedLines.map((l: any) => ({
            detailNumber: l?.detailNumber != null ? String(l.detailNumber) : "",
            embroideryLocation: l?.embroideryLocation != null ? String(l.embroideryLocation) : "",
            stitches: l?.stitches != null ? String(l.stitches) : "",
            pieces: l?.pieces != null ? String(l.pieces) : "",
            is3d: !!l?.is3d,
            isKnit: !!l?.isKnit,
            detailComplete: !!l?.detailComplete,
            notes: l?.notes != null ? String(l.notes) : "",
          }))
        : [blankLine()]
    );
  }

  useEffect(() => {
    if (!initialSubmissionId) return;

    setSelectedSubmissionId(initialSubmissionId);

    (async () => {
      try {
        await loadSubmission(initialSubmissionId);
      } catch (err: any) {
        setServerError(err?.message ?? "Failed to load submission.");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSubmissionId]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);
    setSuccessMsg(null);

    // ✅ Client validation first (prevents bottom server errors)
    const v = validateClient();
    setErrors(v);

    if (hasErrors(v)) {
      // wait a tick so UI shows errors before scrolling
      setTimeout(() => scrollToFirstError(v), 50);
      return;
    }

    setSaving(true);
    try {
      const isUpdate = !!selectedSubmissionId;

      const url = isUpdate
        ? `/api/daily-production-submission?id=${encodeURIComponent(selectedSubmissionId)}`
        : "/api/daily-production-add";

      const method = isUpdate ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entryTs: new Date().toISOString(),
          salesOrder: salesOrder.trim(),
          machineNumber: machineNumber.trim() || null,
          notes: headerNotes.trim() || null,
          lines: lines.map((l) => ({
            detailNumber: l.detailNumber.trim(),
            embroideryLocation: l.embroideryLocation.trim(),
            stitches: l.stitches,
            pieces: l.pieces,
            is3d: !!l.is3d,
            isKnit: !!l.isKnit,
            detailComplete: !!l.detailComplete,
            notes: l.notes?.trim() || null,
          })),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        // ✅ keep server errors here ONLY (rare now that we validate)
        setServerError(data?.error ?? "Failed to save.");
        return;
      }

      setSuccessMsg(isUpdate ? "Updated submission." : "Saved submission.");

      // After save: clear lines + notes; keep SO + machine for fast entry
      setHeaderNotes("");
      setLines([blankLine()]);
      setErrors({});

      const editingByRoute =
        pathname?.startsWith("/daily-production/") && !pathname.startsWith("/daily-production/add");

      // If saved from edit page, return to add page (your current behavior)
      if (editingByRoute) {
        router.push("/daily-production/add");
      } else {
        setSelectedSubmissionId("");
      }
    } catch (err: any) {
      setServerError(err?.message ?? "Unexpected error.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="rounded border p-4 space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <label className="block text-sm font-medium">
              Sales Order <span className="text-red-600">*</span>
            </label>
            <input
              ref={salesOrderRef}
              value={salesOrder}
              onChange={(e) => {
                setSalesOrder(e.target.value);
                clearSalesOrderError();
              }}
              className={inputClass(!!errors.salesOrder)}
              placeholder="1234567"
              inputMode="numeric"
            />
            {errors.salesOrder ? <div className={errTextClass}>{errors.salesOrder}</div> : null}
            <div className="mt-1 text-xs opacity-70">Sales Orders are 7 digits.</div>
          </div>

          <div>
            <label className="block text-sm font-medium">Machine</label>
            {machineOptions.length > 0 ? (
              <select
                value={machineNumber}
                onChange={(e) => setMachineNumber(e.target.value)}
                className={inputClass(false)}
              >
                <option value="">Select…</option>
                {machineOptions.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            ) : (
              <input
                value={machineNumber}
                onChange={(e) => setMachineNumber(e.target.value)}
                className={inputClass(false)}
                placeholder="Optional"
              />
            )}
          </div>

          <div className="md:col-span-3">
            <label className="block text-sm font-medium">Header Notes</label>
            <input
              value={headerNotes}
              onChange={(e) => setHeaderNotes(e.target.value)}
              className={inputClass(false)}
              placeholder="Optional notes that apply to the whole submission"
            />
          </div>
        </div>
      </div>

      <div className="rounded border p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold">Lines</h3>
          <button type="button" onClick={addLine} className="rounded border px-3 py-1 text-sm">
            + Add Line
          </button>
        </div>

        <div className="mt-4 space-y-4">
          {lines.map((line, idx) => {
            const le = errors.lines?.[idx] ?? {};
            return (
              <div key={idx} className="rounded border p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="font-semibold">Line {idx + 1}</div>
                  <button
                    type="button"
                    onClick={() => removeLine(idx)}
                    disabled={!canRemove}
                    className="rounded border px-3 py-1 text-sm disabled:opacity-50"
                  >
                    Remove
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-6">
                  <div className="md:col-span-1">
                    <label className="block text-sm font-medium">
                      Detail # <span className="text-red-600">*</span>
                    </label>
                    <input
                      ref={(el) => {
                        detailRefs.current[idx] = el;
                      }}
                      value={line.detailNumber}
                      onChange={(e) => {
                        updateLine(idx, { detailNumber: e.target.value });
                        clearLineFieldError(idx, "detailNumber");
                      }}
                      className={inputClass(!!le.detailNumber)}
                      placeholder="1"
                      inputMode="numeric"
                    />
                    {le.detailNumber ? <div className={errTextClass}>{le.detailNumber}</div> : null}
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium">
                      Location <span className="text-red-600">*</span>
                    </label>
                    <select
                      ref={(el) => {
                        locRefs.current[idx] = el;
                      }}
                      value={line.embroideryLocation}
                      onChange={(e) => {
                        updateLine(idx, { embroideryLocation: e.target.value });
                        clearLineFieldError(idx, "embroideryLocation");
                      }}
                      className={inputClass(!!le.embroideryLocation)}
                    >
                      <option value="">Select…</option>
                      {locationOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    {le.embroideryLocation ? <div className={errTextClass}>{le.embroideryLocation}</div> : null}
                  </div>

                  <div>
                    <label className="block text-sm font-medium">
                      Stitches <span className="text-red-600">*</span>
                    </label>
                    <input
                      ref={(el) => {
                        stitchesRefs.current[idx] = el;
                      }}
                      value={line.stitches}
                      onChange={(e) => {
                        updateLine(idx, { stitches: e.target.value });
                        clearLineFieldError(idx, "stitches");
                      }}
                      className={inputClass(!!le.stitches)}
                      placeholder="3200"
                      inputMode="numeric"
                    />
                    {le.stitches ? <div className={errTextClass}>{le.stitches}</div> : null}
                  </div>

                  <div>
                    <label className="block text-sm font-medium">
                      Pieces <span className="text-red-600">*</span>
                    </label>
                    <input
                      ref={(el) => {
                        piecesRefs.current[idx] = el;
                      }}
                      value={line.pieces}
                      onChange={(e) => {
                        updateLine(idx, { pieces: e.target.value });
                        clearLineFieldError(idx, "pieces");
                      }}
                      className={inputClass(!!le.pieces)}
                      placeholder="100"
                      inputMode="numeric"
                    />
                    {le.pieces ? <div className={errTextClass}>{le.pieces}</div> : null}
                  </div>

                  <div className="flex items-end gap-4 md:col-span-6">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={line.is3d}
                        onChange={(e) => updateLine(idx, { is3d: e.target.checked })}
                      />
                      <span className="text-sm">3D</span>
                    </label>

                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={line.isKnit}
                        onChange={(e) => updateLine(idx, { isKnit: e.target.checked })}
                      />
                      <span className="text-sm">Knit</span>
                    </label>

                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={line.detailComplete}
                        onChange={(e) => updateLine(idx, { detailComplete: e.target.checked })}
                      />
                      <span className="text-sm">Complete</span>
                    </label>
                  </div>

                  <div className="md:col-span-6">
                    <label className="block text-sm font-medium">Line Notes</label>
                    <input
                      value={line.notes}
                      onChange={(e) => updateLine(idx, { notes: e.target.value })}
                      className={inputClass(false)}
                      placeholder="Optional"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ✅ Server errors ONLY (should be rare now) */}
      {serverError && (
        <div className="rounded border border-red-300 p-3 text-sm">
          {serverError}
        </div>
      )}

      {successMsg && (
        <div className="rounded border border-green-300 p-3 text-sm">
          {successMsg}
        </div>
      )}

      <button type="submit" disabled={saving} className="rounded bg-black px-4 py-2 text-white disabled:opacity-50">
        {saving ? "Saving..." : selectedSubmissionId ? "Update" : "Save"}
      </button>
    </form>
  );
}