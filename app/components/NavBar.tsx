"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

type MeResponse = {
  username?: string;
  displayName?: string;
  employeeNumber?: string;
  role?: string;
  error?: string;
};

export default function NavBar() {
  const pathname = usePathname();
  const router = useRouter();

  const [me, setMe] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadMe() {
    setLoading(true);
    try {
      const res = await fetch("/api/me", { credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setMe(null);
      else setMe(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const authed = !!me && !me.error;

  async function handleLogout() {
    // If your logout route is GET, change method to "GET"
    await fetch("/api/logout", { method: "POST", credentials: "include" }).catch(() => {});
    setMe(null);
    router.push("/login");
    router.refresh();
  }

  // Hide nav on login page
  if (pathname === "/login") return null;

  return (
    <header style={styles.header}>
      <div style={styles.left}>
        <Link href="/dashboard" style={styles.brand}>
          Cap MES
        </Link>

        {authed && (
          <nav style={styles.nav}>
            <NavLink href="/dashboard" pathname={pathname} label="Dashboard" />
            <NavLink href="/daily-production" pathname={pathname} label="Daily Production" />
          </nav>
        )}
      </div>

      <div style={styles.right}>
        {loading ? (
          <span style={styles.muted}>…</span>
        ) : authed ? (
          <>
            <span style={styles.user}>
              {me.displayName || me.username}
              {me.employeeNumber ? ` (#${me.employeeNumber})` : ""}
            </span>
            <button onClick={handleLogout} style={styles.button}>
              Logout
            </button>
          </>
        ) : (
          <Link href="/login" style={styles.link}>
            Login
          </Link>
        )}
      </div>
    </header>
  );
}

function NavLink({
  href,
  pathname,
  label,
}: {
  href: string;
  pathname: string | null;
  label: string;
}) {
  const active = pathname === href || (href !== "/" && pathname?.startsWith(href));
  return (
    <Link
      href={href}
      style={{
        ...styles.link,
        ...(active ? styles.activeLink : {}),
      }}
    >
      {label}
    </Link>
  );
}

const styles: Record<string, React.CSSProperties> = {
  header: {
    position: "sticky",
    top: 0,
    zIndex: 50,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "12px 16px",
    borderBottom: "1px solid #e5e7eb",
    background: "white",
  },
  left: { display: "flex", alignItems: "center", gap: 16 },
  brand: { fontWeight: 700, textDecoration: "none", color: "#111827" },
  nav: { display: "flex", alignItems: "center", gap: 10 },
  right: { display: "flex", alignItems: "center", gap: 12 },
  link: {
    textDecoration: "none",
    color: "#111827",
    padding: "6px 10px",
    borderRadius: 8,
  },
  activeLink: {
    background: "#f3f4f6",
    fontWeight: 600,
  },
  user: { color: "#111827", fontSize: 14 },
  muted: { color: "#6b7280", fontSize: 14 },
  button: {
    padding: "6px 10px",
    borderRadius: 8,
    border: "1px solid #d1d5db",
    background: "white",
    cursor: "pointer",
  },
};
