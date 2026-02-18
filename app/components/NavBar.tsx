"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname.startsWith(href);
}

export default function NavBar() {
  const pathname = usePathname();

  return (
    <nav style={nav}>
      <div style={left}>
        <span style={brand}>Cap MES</span>

        <NavLink href="/dashboard" label="Dashboard" pathname={pathname} />
        <NavLink href="/daily-production" label="Daily Production" pathname={pathname} />
        <NavLink href="/qc-daily-production" label="QC Daily Production" pathname={pathname} />
        <NavLink href="/emblem-production" label="Emblem Production" pathname={pathname} />
      </div>

      <div style={right}>
        <Link href="/logout">Logout</Link>
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
