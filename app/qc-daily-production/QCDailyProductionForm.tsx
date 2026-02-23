"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

type SubmissionOption = {
  id: string;
  entryTs: string;
  salesOrder: number | null;
  notes: string | null;
  lineCount?: number;
};

type Line = {
  detailNumber: string;
  flatOr3d: string; // "FLAT" | "3D"
  orderQuantity: string;
  inspectedQuantity: string;
  rejectedQuantity: string;
  quantityShipped: string;
  notes: string;
};

function blankLine(): Line {
  return {
    detailNumber: "",
    flatOr3d: "FLAT",
    orderQuantity: "",
    inspectedQuantity: "",
    rejectedQuantity: "",
    quantityShipped: "",
    notes: "",
  };
}

function isIntString(s: string) {
  const t = s.trim();
  if (!t) return false;
  const n = Number(t);
  return Number.isFinite(n) && Number.isInteger(n);
}

function isWholeNumberString(v: any) {
  const s = v === null || v === undefined ? "" : String(v).trim();
  if (!s) return false;
  return /^\d+$/.test(s);
}

function isSevenDigitSalesOrder(v: any) {
  const s = v === null || v === undefined ? "" : String(v).trim();
  return /^\d{7}$/.test(s);
}

function formatSubmissionLabel(s: SubmissionOption) {
  const dt = new Date(s.entryTs);
  const dtStr = Number.isNaN(dt.getTime()) ? s.entryTs : dt.toLocaleString();
  const so = s.salesOrder != null ? ` | SO ${s.salesOrder}` : "";
  const count = s.lineCount != null ? ` | ${s.lineCount} line(s)` : "";
  return `${dtStr}${so}${count}`;
}

type Props = { initialSubmissionId?: string };

/** --- Field-level errors --- */
type LineFieldErrors = {
  detailNumber?: string;
  flatOr3d?: string;
  orderQuantity?: string;
  inspectedQuantity?: string;
  rejectedQuantity?: string;
  quantityShipped?: string;
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

export default function QCDailyProductionForm({ initialSubmissionId }: Props) {
  const router = useRouter();
  const pathname = usePathname();

  const isEditRoute = !!initialSubmissionId;

  const [salesOrder, setSalesOrder] = useState("");
  const [headerNotes, setHeaderNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([blankLine()]);

  const [submissions, setSubmissions] = useState<SubmissionOption[]>([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string>(initialSubmissionId ?? "");

  const [saving, setSaving] = useState(false);

  // ✅ server/runtime errors only (not validation)
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // ✅ field-level validation errors
  const [errors, setErrors] = useState<FormErrors>({});

  const canRemove = useMemo(() => lines.length > 1, [lines.length]);

  // --- Refs for auto-scroll/focus ---
  const salesOrderRef = useRef<HTMLInputElement | null>(null);
  const detailRefs = useRef<(HTMLInputElement | null)[]>([]);
  const flatRefs = useRef<(HTMLSelectElement | null)[]>([]);
  const orderRefs = useRef<(HTMLInputElement | null)[]>([]);
  const inspectedRefs = useRef<(HTMLInputElement | null)[]>([]);
  const rejectedRefs = useRef<(HTMLInputElement | null)[]>([]);
  const shippedRefs = useRef<(HTMLInputElement | null)[]>([]);

  // styles
  const errTextClass = "mt-1 text-xs font-semibold text-red-700";
  const inputBaseClass = "mt-1 w-full rounded border px-3 py-2";
  const inputErrorClass = "border-red-500 ring-2 ring-red-200";
  function inputClass(hasErr?: boolean) {
    return `${inputBaseClass} ${hasErr ? inputErrorClass : ""}`;
  }

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
    flatRefs.current.splice(index, 1);
    orderRefs.current.splice(index, 1);
    inspectedRefs.current.splice(index, 1);
    rejectedRefs.current.splice(index, 1);
    shippedRefs.current.splice(index, 1);
  }

  function validateClient(): FormErrors {
    const next: FormErrors = {};

    // ✅ SO required + exactly 7 digits
    if (!salesOrder.trim()) next.salesOrder = "Sales Order is required.";
    else if (!isSevenDigitSalesOrder(salesOrder)) {
      next.salesOrder = "Sales Order must be exactly 7 digits (numbers only).";
    }

    const lineErrors: LineFieldErrors[] = lines.map((l) => {
      const le: LineFieldErrors = {};

      if (!String(l.detailNumber ?? "").trim()) le.detailNumber = "Detail # is required.";
      else if (!isWholeNumberString(l.detailNumber)) le.detailNumber = "Detail # must be a whole number.";

      if (!String(l.flatOr3d ?? "").trim()) le.flatOr3d = "Flat / 3D is required.";

      if (!String(l.orderQuantity ?? "").trim()) le.orderQuantity = "Order Qty is required.";
      else if (!isWholeNumberString(l.orderQuantity)) le.orderQuantity = "Order Qty must be a whole number.";

      if (!String(l.inspectedQuantity ?? "").trim()) le.inspectedQuantity = "Inspected Qty is required.";
      else if (!isWholeNumberString(l.inspectedQuantity)) le.inspectedQuantity = "Inspected Qty must be a whole number.";

      if (!String(l.rejectedQuantity ?? "").trim()) le.rejectedQuantity = "Rejected Qty is required.";
      else if (!isWholeNumberString(l.rejectedQuantity)) le.rejectedQuantity = "Rejected Qty must be a whole number.";

      if (!String(l.quantityShipped ?? "").trim()) le.quantityShipped = "Qty Shipped is required.";
      else if (!isWholeNumberString(l.quantityShipped)) le.quantityShipped = "Qty Shipped must be a whole number.";

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
        if (le.flatOr3d && flatRefs.current[i]) {
          flatRefs.current[i]!.scrollIntoView({ behavior: "smooth", block: "center" });
          flatRefs.current[i]!.focus();
          return;
        }
        if (le.orderQuantity && orderRefs.current[i]) {
          orderRefs.current[i]!.scrollIntoView({ behavior: "smooth", block: "center" });
          orderRefs.current[i]!.focus();
          return;
        }
        if (le.inspectedQuantity && inspectedRefs.current[i]) {
          inspectedRefs.current[i]!.scrollIntoView({ behavior: "smooth", block: "center" });
          inspectedRefs.current[i]!.focus();
          return;
        }
        if (le.rejectedQuantity && rejectedRefs.current[i]) {
          rejectedRefs.current[i]!.scrollIntoView({ behavior: "smooth", block: "center" });
          rejectedRefs.current[i]!.focus();
          return;
        }
        if (le.quantityShipped && shippedRefs.current[i]) {
          shippedRefs.current[i]!.scrollIntoView({ behavior: "smooth", block: "center" });
          shippedRefs.current[i]!.focus();
          return;
        }
      }
    }
  }

  async function loadSubmission(submissionId: string) {
    setServerError(null);
    setSuccessMsg(null);
    setErrors({});

    const res = await fetch(`/api/qc-daily-production-submission?id=${encodeURIComponent(submissionId)}`, {
      cache: "no-store",
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error ?? "Failed to load submission.");

    const submission = data?.submission;
    const loadedLines = Array.isArray(data?.lines) ? data.lines : [];

    if (submission?.salesOrder != null) setSalesOrder(String(submission.salesOrder));
    setHeaderNotes(submission?.notes ?? "");

    setLines(
      loadedLines.length > 0
        ? loadedLines.map((l: any) => ({
            detailNumber: l?.detailNumber != null ? String(l.detailNumber) : "",
            flatOr3d: (l?.flatOr3d ?? "FLAT").toString().toUpperCase(),
            orderQuantity: l?.orderQuantity != null ? String(l.orderQuantity) : "",
            inspectedQuantity: l?.inspectedQuantity != null ? String(l.inspectedQuantity) : "",
            rejectedQuantity: l?.rejectedQuantity != null ? String(l.rejectedQuantity) : "",
            quantityShipped: l?.quantityShipped != null ? String(l.quantityShipped) : "",
            notes: l?.notes != null ? String(l.notes) : "",
          }))
        : [blankLine()]
    );
  }

  // Always auto-load on edit route
  useEffect(() => {
    if (!initialSubmissionId) return;
    setSelectedSubmissionId(initialSubmissionId);

    (async () => {
      try {
        await loadSubmission(initialSubmissionId);
      } catch (e: any) {
        setServerError(e?.message ?? "Failed to load submission.");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSubmissionId]);

  // Add page: load submissions for SO for dropdown (kept as-is)
  useEffect(() => {
    if (isEditRoute) return;

    setSubmissions([]);
    setSelectedSubmissionId("");

    const so = salesOrder.trim();
    if (!isIntString(so)) return;

    const handle = setTimeout(async () => {
      setLoadingSubmissions(true);
      try {
        const res = await fetch(`/api/qc-daily-production-submissions?salesOrder=${encodeURIComponent(so)}`, {
          cache: "no-store",
        });
        const data = await res.json();
        const list = Array.isArray(data?.submissions) ? data.submissions : [];
        setSubmissions(
          list.map((s: any) => ({
            id: String(s.id),
            entryTs: String(s.entryTs),
            salesOrder: s.salesOrder == null ? null : Number(s.salesOrder),
            notes: s.notes == null ? null : String(s.notes),
            lineCount: s.lineCount == null ? undefined : Number(s.lineCount),
          }))
        );
      } catch {
        setSubmissions([]);
      } finally {
        setLoadingSubmissions(false);
      }
    }, 350);

    return () => clearTimeout(handle);
  }, [salesOrder, isEditRoute]);

  // Add page: selecting dropdown loads it
  useEffect(() => {
    if (isEditRoute) return;
    if (!selectedSubmissionId) return;

    (async () => {
      try {
        await loadSubmission(selectedSubmissionId);
      } catch (e: any) {
        setServerError(e?.message ?? "Failed to load submission.");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSubmissionId, isEditRoute]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);
    setSuccessMsg(null);

    // ✅ client-side field validation first
    const v = validateClient();
    setErrors(v);

    if (hasErrors(v)) {
      setTimeout(() => scrollToFirstError(v), 50);
      return;
    }

    setSaving(true);
    try {
      const isUpdate = !!selectedSubmissionId && isEditRoute;

      const url = isUpdate
        ? `/api/qc-daily-production-submission?id=${encodeURIComponent(selectedSubmissionId)}`
        : "/api/qc-daily-production-add";

      const method = isUpdate ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entryTs: new Date().toISOString(),
          salesOrder: salesOrder.trim(),
          notes: headerNotes.trim() || null,
          lines: lines.map((l) => ({
            detailNumber: l.detailNumber.trim(),
            flatOr3d: l.flatOr3d.trim(),
            orderQuantity: l.orderQuantity,
            inspectedQuantity: l.inspectedQuantity,
            rejectedQuantity: l.rejectedQuantity,
            quantityShipped: l.quantityShipped,
            notes: l.notes.trim() || null,
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Failed to save.");

      setSuccessMsg(
        isUpdate
          ? `Updated ${data?.count ?? lines.length} line(s).`
          : `Saved ${data?.count ?? lines.length} line(s).`
      );

      setErrors({});

      if (isEditRoute) {
        router.push("/qc-daily-production");
      } else {
        // keep SO for quick entry, clear header/lines
        setHeaderNotes("");
        setLines([blankLine()]);
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
              readOnly={isEditRoute}
              className={inputClass(!!errors.salesOrder)}
              placeholder="1234567"
              inputMode="numeric"
            />
            {errors.salesOrder ? <div className={errTextClass}>{errors.salesOrder}</div> : null}
            <div className="mt-1 text-xs opacity-70">Sales Orders are 7 digits.</div>
          </div>

          <div className="md:col-span-3">
            <label className="block text-sm font-medium">Header Notes</label>
            <input
              value={headerNotes}
              onChange={(e) => setHeaderNotes(e.target.value)}
              className={inputClass(false)}
              placeholder="Optional"
            />
          </div>

          {/* {!isEditRoute && (
            <div className="md:col-span-3">
              <label className="block text-sm font-medium">Load Previous Submission (optional)</label>
              <select
                value={selectedSubmissionId}
                onChange={(e) => setSelectedSubmissionId(e.target.value)}
                className={inputClass(false)}
                disabled={loadingSubmissions || submissions.length === 0}
              >
                <option value="">
                  {loadingSubmissions
                    ? "Loading…"
                    : submissions.length > 0
                      ? "Select a submission…"
                      : "No submissions found (new saves only)."}
                </option>
                {submissions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {formatSubmissionLabel(s)}
                  </option>
                ))}
              </select>
            </div>
          )} */}
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
                      inputMode="numeric"
                      placeholder="1"
                    />
                    {le.detailNumber ? <div className={errTextClass}>{le.detailNumber}</div> : null}
                  </div>

                  <div className="md:col-span-1">
                    <label className="block text-sm font-medium">
                      Flat / 3D <span className="text-red-600">*</span>
                    </label>
                    <select
                      ref={(el) => {
                        flatRefs.current[idx] = el;
                      }}
                      value={line.flatOr3d}
                      onChange={(e) => {
                        updateLine(idx, { flatOr3d: e.target.value });
                        clearLineFieldError(idx, "flatOr3d");
                      }}
                      className={inputClass(!!le.flatOr3d)}
                    >
                      <option value="FLAT">FLAT</option>
                      <option value="3D">3D</option>
                    </select>
                    {le.flatOr3d ? <div className={errTextClass}>{le.flatOr3d}</div> : null}
                  </div>

                  <div>
                    <label className="block text-sm font-medium">
                      Order Qty <span className="text-red-600">*</span>
                    </label>
                    <input
                      ref={(el) => {
                        orderRefs.current[idx] = el;
                      }}
                      value={line.orderQuantity}
                      onChange={(e) => {
                        updateLine(idx, { orderQuantity: e.target.value });
                        clearLineFieldError(idx, "orderQuantity");
                      }}
                      className={inputClass(!!le.orderQuantity)}
                      inputMode="numeric"
                    />
                    {le.orderQuantity ? <div className={errTextClass}>{le.orderQuantity}</div> : null}
                  </div>

                  <div>
                    <label className="block text-sm font-medium">
                      Inspected Qty <span className="text-red-600">*</span>
                    </label>
                    <input
                      ref={(el) => {
                        inspectedRefs.current[idx] = el;
                      }}
                      value={line.inspectedQuantity}
                      onChange={(e) => {
                        updateLine(idx, { inspectedQuantity: e.target.value });
                        clearLineFieldError(idx, "inspectedQuantity");
                      }}
                      className={inputClass(!!le.inspectedQuantity)}
                      inputMode="numeric"
                    />
                    {le.inspectedQuantity ? <div className={errTextClass}>{le.inspectedQuantity}</div> : null}
                  </div>

                  <div>
                    <label className="block text-sm font-medium">
                      Rejected Qty <span className="text-red-600">*</span>
                    </label>
                    <input
                      ref={(el) => {
                        rejectedRefs.current[idx] = el;
                      }}
                      value={line.rejectedQuantity}
                      onChange={(e) => {
                        updateLine(idx, { rejectedQuantity: e.target.value });
                        clearLineFieldError(idx, "rejectedQuantity");
                      }}
                      className={inputClass(!!le.rejectedQuantity)}
                      inputMode="numeric"
                    />
                    {le.rejectedQuantity ? <div className={errTextClass}>{le.rejectedQuantity}</div> : null}
                  </div>

                  <div>
                    <label className="block text-sm font-medium">
                      Qty Shipped <span className="text-red-600">*</span>
                    </label>
                    <input
                      ref={(el) => {
                        shippedRefs.current[idx] = el;
                      }}
                      value={line.quantityShipped}
                      onChange={(e) => {
                        updateLine(idx, { quantityShipped: e.target.value });
                        clearLineFieldError(idx, "quantityShipped");
                      }}
                      className={inputClass(!!le.quantityShipped)}
                      inputMode="numeric"
                    />
                    {le.quantityShipped ? <div className={errTextClass}>{le.quantityShipped}</div> : null}
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

      {/* ✅ server errors only (not validation) */}
      {serverError && <div className="rounded border border-red-300 p-3 text-sm">{serverError}</div>}
      {successMsg && <div className="rounded border border-green-300 p-3 text-sm">{successMsg}</div>}

      <button type="submit" disabled={saving} className="rounded bg-black px-4 py-2 text-white disabled:opacity-50">
        {saving ? "Saving..." : isEditRoute ? "Update Submission" : "Save"}
      </button>
    </form>
  );
}