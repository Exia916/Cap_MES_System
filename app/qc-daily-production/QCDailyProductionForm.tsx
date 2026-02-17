"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Props =
  | { mode: "add" }
  | { mode: "edit"; id: string };

export default function QCDailyProductionForm(props: Props) {
  const router = useRouter();

  // IMPORTANT: use names that match the API payload (salesOrder, flatOr3d, etc.)
  const [salesOrder, setSalesOrder] = useState("");
  const [detailNumber, setDetailNumber] = useState("");
  const [flatOr3d, setFlatOr3d] = useState("");

  const [orderQuantity, setOrderQuantity] = useState("");
  const [inspectedQuantity, setInspectedQuantity] = useState("");
  const [rejectedQuantity, setRejectedQuantity] = useState("");
  const [quantityShipped, setQuantityShipped] = useState("");

  const [notes, setNotes] = useState("");

  const [loading, setLoading] = useState(props.mode === "edit");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Load existing entry for edit mode
  useEffect(() => {
    if (props.mode !== "edit") return;

    (async () => {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(
          `/api/qc-daily-production-get?id=${encodeURIComponent(props.id)}`,
          { cache: "no-store" }
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error ?? "Failed to load QC entry.");

        const e = data?.entry ?? {};

        setSalesOrder(e?.salesOrder != null ? String(e.salesOrder) : "");
        setDetailNumber(e?.detailNumber != null ? String(e.detailNumber) : "");
        setFlatOr3d(e?.flatOr3d != null ? String(e.flatOr3d) : "");

        setOrderQuantity(e?.orderQuantity != null ? String(e.orderQuantity) : "");
        setInspectedQuantity(e?.inspectedQuantity != null ? String(e.inspectedQuantity) : "");
        setRejectedQuantity(e?.rejectedQuantity != null ? String(e.rejectedQuantity) : "");
        setQuantityShipped(e?.quantityShipped != null ? String(e.quantityShipped) : "");

        setNotes(e?.notes != null ? String(e.notes) : "");
      } catch (err: any) {
        setError(err?.message ?? "Failed to load.");
      } finally {
        setLoading(false);
      }
    })();
  }, [props]);

  function validateClient(): string | null {
    // Adjust required fields as you prefer
    if (!salesOrder.trim()) return "Sales Order is required.";
    if (!detailNumber.trim()) return "Detail # is required.";
    if (!flatOr3d.trim()) return "Flat Or 3D is required.";
    return null;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const msg = validateClient();
    if (msg) {
      setError(msg);
      return;
    }

    setSaving(true);

    try {
      const isEdit = props.mode === "edit";
      const url = isEdit ? "/api/qc-daily-production-update" : "/api/qc-daily-production-add";
      const method = isEdit ? "PUT" : "POST";

      // ✅ IMPORTANT: payload keys match the routes we built:
      // - salesOrder (NOT salesOrderNumber)
      // - flatOr3d (NOT flatOr3D)
      // - NO entryDate sent (DB generates entry_date)
      const payload = {
        ...(isEdit ? { id: props.id } : {}),
        entryTs: new Date().toISOString(),

        salesOrder: salesOrder.trim(),
        detailNumber: detailNumber.trim(),
        flatOr3d: flatOr3d.trim(),

        orderQuantity: orderQuantity.trim(),
        inspectedQuantity: inspectedQuantity.trim(),
        rejectedQuantity: rejectedQuantity.trim(),
        quantityShipped: quantityShipped.trim(),

        notes: notes.trim() || null,
      };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Failed to save.");

      setSuccessMsg(isEdit ? "Updated." : "Saved.");

      if (!isEdit) {
        // reset form on add
        setSalesOrder("");
        setDetailNumber("");
        setFlatOr3d("");
        setOrderQuantity("");
        setInspectedQuantity("");
        setRejectedQuantity("");
        setQuantityShipped("");
        setNotes("");
      } else {
        // return to list after edit
        router.push("/qc-daily-production");
      }
    } catch (err: any) {
      setError(err?.message ?? "Unexpected error.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p>Loading…</p>;

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {error && <div className="rounded border border-red-300 p-3 text-sm">{error}</div>}
      {successMsg && <div className="rounded border border-green-300 p-3 text-sm">{successMsg}</div>}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div>
          <label className="block text-sm font-medium">Sales Order #</label>
          <input
            className="mt-1 w-full rounded border px-3 py-2"
            value={salesOrder}
            onChange={(e) => setSalesOrder(e.target.value)}
            placeholder="1234567"
          />
        </div>

        <div>
          <label className="block text-sm font-medium">Detail #</label>
          <input
            className="mt-1 w-full rounded border px-3 py-2"
            value={detailNumber}
            onChange={(e) => setDetailNumber(e.target.value)}
            placeholder="1"
            inputMode="numeric"
          />
        </div>

        <div>
          <label className="block text-sm font-medium">Flat Or 3D</label>
          <select
            className="mt-1 w-full rounded border px-3 py-2"
            value={flatOr3d}
            onChange={(e) => setFlatOr3d(e.target.value)}
          >
            <option value="">Select…</option>
            <option value="FLAT">FLAT</option>
            <option value="3D">3D</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium">Order Qty</label>
          <input
            className="mt-1 w-full rounded border px-3 py-2"
            inputMode="numeric"
            value={orderQuantity}
            onChange={(e) => setOrderQuantity(e.target.value)}
            placeholder="100"
          />
        </div>

        <div>
          <label className="block text-sm font-medium">Inspected Qty</label>
          <input
            className="mt-1 w-full rounded border px-3 py-2"
            inputMode="numeric"
            value={inspectedQuantity}
            onChange={(e) => setInspectedQuantity(e.target.value)}
            placeholder="100"
          />
        </div>

        <div>
          <label className="block text-sm font-medium">Rejected Qty</label>
          <input
            className="mt-1 w-full rounded border px-3 py-2"
            inputMode="numeric"
            value={rejectedQuantity}
            onChange={(e) => setRejectedQuantity(e.target.value)}
            placeholder="0"
          />
        </div>

        <div>
          <label className="block text-sm font-medium">Qty Shipped</label>
          <input
            className="mt-1 w-full rounded border px-3 py-2"
            inputMode="numeric"
            value={quantityShipped}
            onChange={(e) => setQuantityShipped(e.target.value)}
            placeholder="100"
          />
        </div>

        <div className="md:col-span-3">
          <label className="block text-sm font-medium">Notes</label>
          <input
            className="mt-1 w-full rounded border px-3 py-2"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={saving}
        className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
      >
        {saving ? "Saving..." : props.mode === "edit" ? "Update" : "Save"}
      </button>
    </form>
  );
}
