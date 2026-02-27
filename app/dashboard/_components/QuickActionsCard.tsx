// app/dashboard/_components/QuickActionsCard.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type MeResponse = {
  username?: string | null;
  role?: string | null;
};

function roleUpper(v: string | null | undefined) {
  return (v ?? "").trim().toUpperCase();
}
function usernameLower(v: string | null | undefined) {
  return (v ?? "").trim().toLowerCase();
}

export default function QuickActionsCard() {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/me", {
          cache: "no-store",
          credentials: "include",
        });

        const json = (await res.json().catch(() => ({}))) as MeResponse;
        if (!cancelled) setMe(json);
      } catch {
        if (!cancelled) setMe(null);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const role = useMemo(() => roleUpper(me?.role), [me?.role]);
  const username = useMemo(() => usernameLower(me?.username), [me?.username]);

  // ✅ Admin fallback remains consistent with your app
  const isAdmin = role === "ADMIN" || username === "admin";
  const isManager = role === "MANAGER";

  // ✅ Admin sees Manager too
  const canSeeManagerHub = isManager || isAdmin;

  return (
    <div className="rounded-xl border bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-lg font-semibold">Quick Actions</div>
          <div className="mt-1 text-sm text-gray-600">
            Common shortcuts for daily work.
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Everyone sees module entries (for now) */}
          <Link className="pill" href="/daily-production">
            + Daily Production Entry
          </Link>
          <Link className="pill" href="/qc-daily-production">
            + QC Entry
          </Link>
          <Link className="pill" href="/emblem-production">
            + Emblem Entry
          </Link>
          <Link className="pill" href="/laser-production">
            + Laser Entry
          </Link>

          {/* Manager hub: MANAGER + ADMIN */}
          {loaded && canSeeManagerHub ? (
            <Link className="pill" href="/manager">
              → Manager
            </Link>
          ) : null}

          {/* Admin hub: ADMIN only */}
          {loaded && isAdmin ? (
            <Link className="pill" href="/admin">
              → Admin
            </Link>
          ) : null}
        </div>
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
          white-space: nowrap;
        }
        .pill:hover {
          background: #f9fafb;
        }
      `}</style>
    </div>
  );
}