// app/manager/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type MeResponse = {
  username?: string | null;
  role?: string | null;
};

export default function ManagerPage() {
  const router = useRouter();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/me", { cache: "no-store", credentials: "include" });
        const json = (await res.json().catch(() => ({}))) as MeResponse;
        if (!cancelled) {
          setMe(json);
          setLoaded(true);
        }
      } catch {
        if (!cancelled) {
          setMe(null);
          setLoaded(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const role = useMemo(() => (me?.role ?? "").toUpperCase(), [me?.role]);
  const username = useMemo(() => (me?.username ?? "").toLowerCase(), [me?.username]);

  const isAdmin = role === "ADMIN" || username === "admin";
  const isManagerRole = isAdmin || role === "MANAGER" || role === "SUPERVISOR";

  useEffect(() => {
    if (!loaded) return;
    if (!isManagerRole) router.replace("/dashboard");
  }, [loaded, isManagerRole, router]);

  if (!loaded) return <div className="p-6">Loading…</div>;
  if (!isManagerRole) return null;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold">Manager</h1>
      <p className="mt-1 text-sm text-gray-600">
        Manager/All-views shortcuts.
      </p>

      <div className="mt-5 flex flex-wrap gap-2">
        <Link className="pill" href="/admin/daily-production-all">
          → Daily Production (All)
        </Link>

        <Link className="pill" href="/admin/qc-daily-production-all">
          → QC Daily (All)
        </Link>

        <Link className="pill" href="/admin/emblem-production-all">
          → Emblem (All)
        </Link>

        <Link className="pill" href="/admin/laser-production-all">
          → Laser (All)
        </Link>
      </div>

      <style jsx global>{`
        .pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          height: 34px;
          padding: 0 14px;
          border-radius: 9999px;
          border: 1px solid #d1d5db;
          background: #ffffff;
          font-size: 13px;
          font-weight: 600;
          color: #111827;
          text-decoration: none;
        }
        .pill:hover {
          background: #f9fafb;
        }
      `}</style>
    </div>
  );
}