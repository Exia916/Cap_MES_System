"use client";

import { useEffect, useMemo, useState } from "react";
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

const MACHINE_STORAGE_KEY = "capmes.dailyProduction.machineNumber";

export default function DailyProductionForm() {
  const router = useRouter();
  const pathname = usePathname();

  const [salesOrder, setSalesOrder] = useState("");
  const [machineNumber, setMachineNumber] = useState("");
  const [headerNotes, setHeaderNotes] = useState("");

  const [lines, setLines] = useState<Line[]>([blankLine()]);

  const [locationOptions, setLocationOptions] = useState<LocationOption[]>([]);
  const [machineOptions, setMachineOptions] = useState<MachineOption[]>([]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const canRemove = useMemo(() => lines.length > 1, [lines.length]);

  // ✅ Load previously selected machine (so it survives navigation / refresh)
  useEffect(() => {
    try {
      const saved = localStorage.getItem(MACHINE_STORAGE_KEY);
      if (saved && !machineNumber) setMachineNumber(saved);
    } catch {
      // ignore
    }
    // run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ✅ Persist machine whenever it changes
  useEffect(() => {
    try {
      if (machineNumber) localStorage.setItem(MACHINE_STORAGE_KEY, machineNumber);
    } catch {
      // ignore
    }
  }, [machineNumber]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/embroidery-locations", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();

        const opts: LocationOption[] =
          Array.isArray(data)
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

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/machines", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();

        const opts: MachineOption[] =
          Array.isArray(data)
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
  }

  function removeLine(index: number) {
    setLines((prev) => prev.filter((_, i) => i !== index));
  }

  function validateClient(): string | null {
    if (!salesOrder.trim()) return "Sales Order is required.";

    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (!l.detailNumber.trim()) return `Line ${i + 1}: Detail # is required.`;
      if (!l.embroideryLocation.trim()) return `Line ${i + 1}: Location is required.`;
    }
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
      const res = await fetch("/api/daily-production-add", {
        method: "POST",
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
        setError(data?.error ?? "Failed to save.");
        return;
      }

      setSuccessMsg(`Saved ${data?.count ?? lines.length} line(s).`);

      // ✅ Clear everything EXCEPT machineNumber
      setSalesOrder("");
      setHeaderNotes("");
      setLines([blankLine()]);

      // ✅ If we saved from the edit page, go back to "new entry"
      // Edit routes look like: /daily-production/<id>
      // New entry route: /daily-production/add
      if (pathname?.startsWith("/daily-production/") && !pathname.startsWith("/daily-production/add")) {
        router.push("/daily-production/add");
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
              className="mt-1 w-full rounded border px-3 py-2"
              placeholder="123456"
            />
          </div>

          <div>
            <label className="block text-sm font-medium">Machine</label>
            {machineOptions.length > 0 ? (
              <select
                value={machineNumber}
                onChange={(e) => setMachineNumber(e.target.value)}
                className="mt-1 w-full rounded border px-3 py-2"
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
                className="mt-1 w-full rounded border px-3 py-2"
                placeholder="Optional"
              />
            )}
          </div>

          <div className="md:col-span-3">
            <label className="block text-sm font-medium">Header Notes</label>
            <input
              value={headerNotes}
              onChange={(e) => setHeaderNotes(e.target.value)}
              className="mt-1 w-full rounded border px-3 py-2"
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
                    placeholder="10"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium">Location</label>
                  <select
                    value={line.embroideryLocation}
                    onChange={(e) => updateLine(idx, { embroideryLocation: e.target.value })}
                    className="mt-1 w-full rounded border px-3 py-2"
                  >
                    <option value="">Select…</option>
                    {locationOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium">Stitches</label>
                  <input
                    value={line.stitches}
                    onChange={(e) => updateLine(idx, { stitches: e.target.value })}
                    className="mt-1 w-full rounded border px-3 py-2"
                    placeholder="3200"
                    inputMode="numeric"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium">Pieces</label>
                  <input
                    value={line.pieces}
                    onChange={(e) => updateLine(idx, { pieces: e.target.value })}
                    className="mt-1 w-full rounded border px-3 py-2"
                    placeholder="12"
                    inputMode="numeric"
                  />
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
        {saving ? "Saving..." : "Save"}
      </button>
    </form>
  );
}
