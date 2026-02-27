// app/dashboard/_components/WelcomeCard.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type MeResponse = {
  id?: string;
  username?: string;
  displayName?: string;
  name?: string;
  employeeNumber?: number;
  role?: string;
  error?: string;
};

function formatWelcomeName(me: MeResponse) {
  const raw = (me.displayName || me.name || me.username || "").trim();
  return raw || "User";
}

export default function WelcomeCard() {
  const [me, setMe] = useState<MeResponse | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const res = await fetch("/api/me", { cache: "no-store" });
      const json: MeResponse = await res.json().catch(() => ({} as any));
      if (!cancelled) setMe(json);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const role = (me?.role || "").toUpperCase();

  return (
    <div className="rounded-xl border bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-2xl font-semibold">
            Welcome, {formatWelcomeName(me || {})}
          </div>

          <div className="mt-1 text-sm text-gray-600">
            Username: <span className="font-semibold">{me?.username || "—"}</span>
            {" · "}
            Employee ID:{" "}
            <span className="font-semibold">{me?.employeeNumber ?? "—"}</span>
            {me?.role ? (
              <>
                {" · "}
                Role: <span className="font-semibold">{role}</span>
              </>
            ) : null}
          </div>

          <div className="mt-3 text-sm text-gray-600">
            Use the navigation bar to access modules. Manager/Admin options appear
            based on your role.
          </div>
        </div>

        {/* ✅ New link to Metrics page */}
        <div className="flex flex-wrap items-center gap-2">
          <Link className="pill" href="/dashboard/metrics">
            → My Metrics
          </Link>
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
        }
        .pill:hover {
          background: #f9fafb;
        }
      `}</style>
    </div>
  );
}