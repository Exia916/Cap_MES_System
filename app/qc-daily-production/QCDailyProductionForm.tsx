"use client";

import { useEffect, useMemo, useState } from "react";
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

function formatSubmissionLabel(s: SubmissionOption) {
  const dt = new Date(s.entryTs);
  const dtStr = Number.isNaN(dt.getTime()) ? s.entryTs : dt.toLocaleString();
  const so = s.salesOrder != null ? ` | SO ${s.salesOrder}` : "";
  const count = s.lineCount != null ? ` | ${s.lineCount} line(s)` : "";
  return `${dtStr}${so}${count}`;
}

type Props = { initialSubmissionId?: string };

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
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const canRemove = useMemo(() => lines.length > 1, [lines.length]);

  function updateLine(index: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }
  function addLine() {
    setLines((prev) => [...prev, blankLine()]);
  }
  function removeLine(index: number) {
    setLines((prev) => prev.filter((_, i) => i !== index));
  }

  function validateClient(): string | null {
    if (!salesOrder.trim()) return "Sales Order is required.";
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (!l.detailNumber.trim()) return `Line ${i + 1}: Detail # is required.`;
      if (!l.flatOr3d.trim()) return `Line ${i + 1}: Flat/3D is required.`;
    }
    return null;
  }

  async function loadSubmission(submissionId: string) {
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
        setError(e?.message ?? "Failed to load submission.");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSubmissionId]);

  // Add page: load submissions for SO for dropdown
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
        setError(e?.message ?? "Failed to load submission.");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSubmissionId, isEditRoute]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const msg = validateClient();
    if (msg) return setError(msg);

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

      setSuccessMsg(isUpdate ? `Updated ${data?.count ?? lines.length} line(s).` : `Saved ${data?.count ?? lines.length} line(s).`);

      if (isEditRoute) {
        router.push("/qc-daily-production");
      } else {
        // keep SO for quick entry, clear header/lines
        setHeaderNotes("");
        setLines([blankLine()]);
        setSelectedSubmissionId("");
      }
    } catch (err: any) {
      setError(err?.message ?? "Unexpected error.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="rounded border p-4 space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <label className="block text-sm font-medium">Sales Order</label>
            <input
              value={salesOrder}
              onChange={(e) => setSalesOrder(e.target.value)}
              readOnly={isEditRoute}
              className="mt-1 w-full rounded border px-3 py-2"
              placeholder="1234567"
            />
          </div>

          <div className="md:col-span-3">
            <label className="block text-sm font-medium">Header Notes</label>
            <input
              value={headerNotes}
              onChange={(e) => setHeaderNotes(e.target.value)}
              className="mt-1 w-full rounded border px-3 py-2"
              placeholder="Optional"
            />
          </div>

          {!isEditRoute && (
            <div className="md:col-span-3">
              <label className="block text-sm font-medium">Load Previous Submission (optional)</label>
              <select
                value={selectedSubmissionId}
                onChange={(e) => setSelectedSubmissionId(e.target.value)}
                className="mt-1 w-full rounded border px-3 py-2"
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
          )}
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
          {lines.map((line, idx) => (
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
                  <label className="block text-sm font-medium">Detail #</label>
                  <input
                    value={line.detailNumber}
                    onChange={(e) => updateLine(idx, { detailNumber: e.target.value })}
                    className="mt-1 w-full rounded border px-3 py-2"
                    inputMode="numeric"
                    placeholder="1"
                  />
                </div>

                <div className="md:col-span-1">
                  <label className="block text-sm font-medium">Flat / 3D</label>
                  <select
                    value={line.flatOr3d}
                    onChange={(e) => updateLine(idx, { flatOr3d: e.target.value })}
                    className="mt-1 w-full rounded border px-3 py-2"
                  >
                    <option value="FLAT">FLAT</option>
                    <option value="3D">3D</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium">Order Qty</label>
                  <input
                    value={line.orderQuantity}
                    onChange={(e) => updateLine(idx, { orderQuantity: e.target.value })}
                    className="mt-1 w-full rounded border px-3 py-2"
                    inputMode="numeric"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium">Inspected Qty</label>
                  <input
                    value={line.inspectedQuantity}
                    onChange={(e) => updateLine(idx, { inspectedQuantity: e.target.value })}
                    className="mt-1 w-full rounded border px-3 py-2"
                    inputMode="numeric"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium">Rejected Qty</label>
                  <input
                    value={line.rejectedQuantity}
                    onChange={(e) => updateLine(idx, { rejectedQuantity: e.target.value })}
                    className="mt-1 w-full rounded border px-3 py-2"
                    inputMode="numeric"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium">Qty Shipped</label>
                  <input
                    value={line.quantityShipped}
                    onChange={(e) => updateLine(idx, { quantityShipped: e.target.value })}
                    className="mt-1 w-full rounded border px-3 py-2"
                    inputMode="numeric"
                  />
                </div>

                <div className="md:col-span-6">
                  <label className="block text-sm font-medium">Line Notes</label>
                  <input
                    value={line.notes}
                    onChange={(e) => updateLine(idx, { notes: e.target.value })}
                    className="mt-1 w-full rounded border px-3 py-2 w-full"
                    placeholder="Optional"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {error && <div className="rounded border border-red-300 p-3 text-sm">{error}</div>}
      {successMsg && <div className="rounded border border-green-300 p-3 text-sm">{successMsg}</div>}

      <button type="submit" disabled={saving} className="rounded bg-black px-4 py-2 text-white disabled:opacity-50">
        {saving ? "Saving..." : isEditRoute ? "Update Submission" : "Save"}
      </button>
    </form>
  );
}
