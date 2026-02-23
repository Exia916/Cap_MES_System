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
  const username = (me?.username || "").toLowerCase();

  // ✅ robust role detection (role preferred, username fallback)
  const isAdmin = role === "ADMIN" || username === "admin";
  const isManagerRole =
    role === "ADMIN" || role === "SUPERVISOR" || role === "MANAGER" || username === "admin";

  // Toggle these while you’re still building manager/all pages
  const showManagerAllLinks = true; // ✅ Daily Production All is ready
  const showModuleLinks = false; // existing module links (/daily-production etc) toggle

  // Toggle these one-by-one as you build them
  const enableQCDailyAll = true; // ✅ ready
  const enableEmblemAll = true; // ✅ ready
  const enableLaserAll = true; // ✅ ready

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
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Existing module pages (non-admin) */}
          {showModuleLinks ? (
            <>
              <Link className="pill" href="/daily-production">
                → All Embroidery Entries
              </Link>
              <Link className="pill" href="/qc-daily-production">
                → All QC Entries
              </Link>
              <Link className="pill" href="/emblem-production">
                → All Emblem Entries
              </Link>
              <Link className="pill" href="/laser-production">
                → All Laser Entries
              </Link>
            </>
          ) : null}

          {/* Manager/Admin “All” views */}
          {showManagerAllLinks && isManagerRole ? (
            <>
              <Link className="pill" href="/admin/daily-production-all">
                → Daily Production (All)
              </Link>

              {enableQCDailyAll ? (
                <Link className="pill" href="/admin/qc-daily-production-all">
                  → QC Daily (All)
                </Link>
              ) : null}

              {enableEmblemAll ? (
                <Link className="pill" href="/admin/emblem-production-all">
                  → Emblem (All)
                </Link>
              ) : null}

              {enableLaserAll ? (
                <Link className="pill" href="/admin/laser-production-all">
                  → Laser (All)
                </Link>
              ) : null}
            </>
          ) : null}

          {/* Admin-only */}
          {isAdmin ? (
            <Link className="pill" href="/admin/users">
              → Admin Users
            </Link>
          ) : null}

          <Link className="pill-danger" href="/logout">
            Logout
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
        .pill-danger {
          display: inline-flex;
          align-items: center;
          height: 34px;
          padding: 0 14px;
          border-radius: 9999px;
          border: none;
          background: #ef4444;
          color: #ffffff;
          font-size: 13px;
          font-weight: 700;
          text-decoration: none;
        }
        .pill-danger:hover {
          background: #dc2626;
        }
      `}</style>
    </div>
  );
}