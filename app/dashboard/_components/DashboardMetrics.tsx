"use client";

import { useEffect, useMemo, useState } from "react";

type Metrics = {
  date: string;

  totalStitches: number;
  totalPieces: number;

  qcFlatInspected: number;
  qc3DInspected: number;
  qcTotalInspected: number;

  emblemSewPieces: number;
  emblemStickerPieces: number;
  emblemHeatSealPieces: number;
  emblemTotalPieces: number;

  laserTotalPieces: number;
};

type ModuleKey = "embroidery" | "qc" | "emblem" | "laser";

function ymdLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function fmt(n: number) {
  return new Intl.NumberFormat().format(Math.round(Number(n || 0)));
}

async function fetchMetrics(date: string): Promise<Metrics> {
  const res = await fetch(`/api/dashboard-metrics?date=${encodeURIComponent(date)}`, {
    cache: "no-store",
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json?.error || `Request failed (${res.status})`);
  }
  return json as Metrics;
}

function useModuleMetrics(initialDate: string) {
  const [date, setDate] = useState(initialDate);
  const [data, setData] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setErr("");
      try {
        const d = await fetchMetrics(date);
        if (!cancelled) setData(d);
      } catch (e: any) {
        if (!cancelled) setErr(e?.message || "Failed to load metrics");
        if (!cancelled) setData(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [date]);

  return { date, setDate, data, loading, err };
}

export default function DashboardMetrics() {
  const today = useMemo(() => ymdLocal(), []);

  const embroidery = useModuleMetrics(today);
  const qc = useModuleMetrics(today);
  const emblem = useModuleMetrics(today);
  const laser = useModuleMetrics(today);

  return (
    <div className="space-y-4">
      <MetricPanel
        title="Embroidery Metrics"
        date={embroidery.date}
        setDate={embroidery.setDate}
        showingText={`Showing metrics for ${embroidery.date}`}
        loading={embroidery.loading}
        err={embroidery.err}
      >
        <StatCard label="My Total Stitches" value={fmt(embroidery.data?.totalStitches ?? 0)} />
        <StatCard label="My Total Pieces" value={fmt(embroidery.data?.totalPieces ?? 0)} />
      </MetricPanel>

      <MetricPanel
        title="QC Metrics"
        date={qc.date}
        setDate={qc.setDate}
        showingText={`Showing metrics for ${qc.date}`}
        loading={qc.loading}
        err={qc.err}
      >
        <StatCard label="QC Flat Qty Inspected" value={fmt(qc.data?.qcFlatInspected ?? 0)} />
        <StatCard label="QC 3D Qty Inspected" value={fmt(qc.data?.qc3DInspected ?? 0)} />
        <StatCard label="QC Total Qty Inspected" value={fmt(qc.data?.qcTotalInspected ?? 0)} />
      </MetricPanel>

      <MetricPanel
        title="Emblem Metrics"
        date={emblem.date}
        setDate={emblem.setDate}
        showingText={`Showing metrics for ${emblem.date}`}
        loading={emblem.loading}
        err={emblem.err}
      >
        <StatCard label="Emblem Sew Pieces" value={fmt(emblem.data?.emblemSewPieces ?? 0)} />
        <StatCard label="Emblem Sticker Pieces" value={fmt(emblem.data?.emblemStickerPieces ?? 0)} />
        <StatCard label="Emblem Heat Seal Pieces" value={fmt(emblem.data?.emblemHeatSealPieces ?? 0)} />
        <StatCard label="Emblem Total Pieces" value={fmt(emblem.data?.emblemTotalPieces ?? 0)} />
      </MetricPanel>

      <MetricPanel
        title="Laser Metrics"
        date={laser.date}
        setDate={laser.setDate}
        showingText={`Showing metrics for ${laser.date}`}
        loading={laser.loading}
        err={laser.err}
      >
        <StatCard label="Laser Total Pieces Cut" value={fmt(laser.data?.laserTotalPieces ?? 0)} />
      </MetricPanel>
    </div>
  );
}

function MetricPanel({
  title,
  date,
  setDate,
  showingText,
  loading,
  err,
  children,
}: {
  title: string;
  date: string;
  setDate: (v: string) => void;
  showingText: string;
  loading: boolean;
  err: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border bg-white p-4">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-base font-semibold">{title}</h3>

        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-600">
          <div className="flex items-center gap-2">
            <span className="font-medium">Date:</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-8 rounded-md border bg-background px-2 text-xs"
            />
          </div>

          <span>{showingText}</span>
          {loading ? <span className="text-gray-400">(loading)</span> : null}
        </div>
      </div>

      {err ? (
        <div className="mb-3 rounded-md border border-red-300 bg-red-50 p-2 text-xs text-red-700">
          {err}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {children}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border p-3">
      <div className="text-xs text-gray-600">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </div>
  );
}
