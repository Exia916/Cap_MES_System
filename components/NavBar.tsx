"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname.startsWith(href);
}

type Me = {
  username: string | null;
  displayName: string | null;
  employeeNumber: number | null;
  role: string | null;
};

export default function NavBar() {
  const pathname = usePathname();
  const [me, setMe] = useState<Me | null>(null);
  const [meLoaded, setMeLoaded] = useState(false);

  const fetchMe = useCallback(async () => {
    setMeLoaded(false);
    try {
      const res = await fetch("/api/me", {
        credentials: "include",
        cache: "no-store",
      });

      if (!res.ok) {
        setMe(null);
        setMeLoaded(true);
        return;
      }

      const data = (await res.json()) as Me;
      setMe(data);
      setMeLoaded(true);
    } catch {
      setMe(null);
      setMeLoaded(true);
    }
  }, []);

  // 1) initial load + 2) refetch on route change (covers login navigation)
  useEffect(() => {
    fetchMe();
  }, [fetchMe, pathname]);

  // 3) refetch when tab becomes visible again or window regains focus
  useEffect(() => {
    function onFocus() {
      fetchMe();
    }
    function onVis() {
      if (document.visibilityState === "visible") fetchMe();
    }

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVis);

    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [fetchMe]);

  const display =
    me?.displayName?.trim() ||
    me?.username?.trim() ||
    (me?.employeeNumber != null ? `#${me.employeeNumber}` : "");

  return (
    <nav style={nav}>
      <div style={left}>
        <span style={brand}>Cap MES</span>

        <NavLink href="/dashboard" label="Dashboard" pathname={pathname} />
        <NavLink href="/daily-production" label="Daily Production" pathname={pathname} />
        <NavLink href="/qc-daily-production" label="QC Daily Production" pathname={pathname} />
        <NavLink href="/emblem-production" label="Emblem Production" pathname={pathname} />
        <NavLink href="/laser-production" label="Laser Production" pathname={pathname} />
      </div>

      <div style={right}>
        <span style={userPill}>{meLoaded ? (display || "Unknown") : "…"}</span>

        {/* Clear local navbar state immediately so it never shows the wrong name */}
        <Link
          href="/logout"
          onClick={() => {
            setMe(null);
            setMeLoaded(false);
          }}
        >
          Logout
        </Link>
      </div>
    </nav>
  );
}

function NavLink({
  href,
  label,
  pathname,
}: {
  href: string;
  label: string;
  pathname: string;
}) {
  const active = isActive(pathname, href);

  return (
    <Link
      href={href}
      style={{
        ...link,
        ...(active ? activeLink : {}),
      }}
    >
      {label}
    </Link>
  );
}

/* ---------- Styles ---------- */

const nav: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "12px 24px",
  borderBottom: "1px solid #ddd",
  background: "#fff",
};

const left: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 16,
};

const right: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 16,
};

const brand: React.CSSProperties = {
  fontWeight: 600,
  marginRight: 16,
};

const link: React.CSSProperties = {
  textDecoration: "none",
  padding: "6px 10px",
  borderRadius: 6,
  color: "#000",
};

const activeLink: React.CSSProperties = {
  backgroundColor: "#f0f0f0",
  fontWeight: 600,
};

const userPill: React.CSSProperties = {
  fontSize: 12,
  padding: "6px 10px",
  borderRadius: 999,
  border: "1px solid #ddd",
  background: "#fafafa",
  minWidth: 90,
  textAlign: "center",
};
