"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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

type MenuItem = {
  href?: string;
  label: string;
  show?: boolean;
  kind?: "link" | "section";
};

type OpenMenu =
  | null
  | "production"
  | "recut"
  | "maintenance"
  | "manager"
  | "admin"
  | "more"
  | "user";

export default function NavBar() {
  const pathname = usePathname() || "";
  const router = useRouter();

  const [me, setMe] = useState<Me | null>(null);
  const [meLoaded, setMeLoaded] = useState(false);

  const [globalQ, setGlobalQ] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [openMenu, setOpenMenu] = useState<OpenMenu>(null);
  const menusWrapRef = useRef<HTMLDivElement | null>(null);

  const [navMode, setNavMode] = useState<"wide" | "medium" | "small">("wide");

  useEffect(() => {
    function compute() {
      const w = window.innerWidth || 1400;
      if (w < 900) setNavMode("small");
      else if (w < 1400) setNavMode("medium");
      else setNavMode("wide");
    }
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, []);

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

  useEffect(() => {
    fetchMe();
  }, [fetchMe, pathname]);

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

  useEffect(() => {
    function onDown(e: MouseEvent) {
      const el = menusWrapRef.current;
      if (!el) return;
      if (e.target instanceof Node && !el.contains(e.target)) setOpenMenu(null);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpenMenu(null);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const display =
    me?.displayName?.trim() ||
    me?.username?.trim() ||
    (me?.employeeNumber != null ? `#${me.employeeNumber}` : "");

  const role = useMemo(() => (me?.role ?? "").trim().toUpperCase(), [me?.role]);
  const username = useMemo(() => (me?.username ?? "").trim().toLowerCase(), [me?.username]);

  const isAdmin = role === "ADMIN" || username === "admin";
  const isManager = isAdmin || role === "MANAGER" || role === "SUPERVISOR";

  const canGlobalSearch = isAdmin || role === "MANAGER";

  const canSeeRepairRequests =
    meLoaded && (isAdmin || role === "MANAGER" || role === "SUPERVISOR");

  const canSeeCMMS = meLoaded && (isAdmin || role === "TECH");

  const canSeeRecuts =
    meLoaded && (isAdmin || role === "MANAGER" || role === "SUPERVISOR" || role === "USER");

  const canSeeRecutReview =
    meLoaded && (isAdmin || role === "MANAGER" || role === "SUPERVISOR");

  const canSeeWarehouseRecuts =
    meLoaded &&
    (isAdmin ||
      role === "MANAGER" ||
      role === "SUPERVISOR" ||
      role === "WAREHOUSE");

  const canSeeCmmsMasterData = meLoaded && (isAdmin || role === "TECH");

  function runGlobalSearch() {
    const q = globalQ.trim();
    if (!q) return;
    setOpenMenu(null);
    router.push(`/admin/global-search?q=${encodeURIComponent(q)}`);
  }

  function onGlobalKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") runGlobalSearch();
    if (e.key === "Escape") setOpenMenu(null);
  }

  const productionItems: MenuItem[] = [
    { href: "/daily-production", label: "Embroidery" },
    { href: "/qc-daily-production", label: "QC" },
    { href: "/emblem-production", label: "Emblem" },
    { href: "/laser-production", label: "Laser" },
  ];

  const recutItems: MenuItem[] = [
    { href: "/recuts", label: "Recuts", show: canSeeRecuts },
    { href: "/recuts/supervisor-review", label: "Supervisor Review", show: canSeeRecutReview },
    { href: "/recuts/warehouse", label: "Warehouse Recuts", show: canSeeWarehouseRecuts },
  ].filter((x) => x.show !== false);

  const maintenanceItems: MenuItem[] = [
    { kind: "section", label: "Operations", show: canSeeRepairRequests || canSeeCMMS },
    { href: "/cmms/repair-requests", label: "Repair Requests", show: canSeeRepairRequests },
    { href: "/cmms", label: "CMMS", show: canSeeCMMS },

    { kind: "section", label: "Configuration", show: canSeeCmmsMasterData },
    { href: "/admin/master-data/priorities", label: "CMMS Priorities", show: canSeeCmmsMasterData },
    { href: "/admin/master-data/statuses", label: "CMMS Statuses", show: canSeeCmmsMasterData },
    { href: "/admin/master-data/issue_catalog", label: "Issue Catalog", show: canSeeCmmsMasterData },
    { href: "/admin/master-data/techs", label: "CMMS Techs", show: canSeeCmmsMasterData },
    { href: "/admin/master-data/wo_types", label: "Work Order Types", show: canSeeCmmsMasterData },
    { href: "/admin/master-data/cmms_departments", label: "CMMS Departments", show: canSeeCmmsMasterData },
    { href: "/admin/master-data/cmms_assets", label: "CMMS Assets", show: canSeeCmmsMasterData },
  ].filter((x) => x.show !== false);

  const managerItems: MenuItem[] = [
    { href: "/manager", label: "Manager", show: meLoaded && isManager },
  ].filter((x) => x.show !== false);

  const adminItems: MenuItem[] = [
    { kind: "section", label: "Administration", show: meLoaded && isAdmin },
    { href: "/admin", label: "Admin Home", show: meLoaded && isAdmin },
    { href: "/admin/users", label: "Admin Users", show: meLoaded && isAdmin },
    { href: "/admin/master-data", label: "Master Data (Lists)", show: meLoaded && isAdmin },
    { href: "/admin/logs", label: "Application Logs", show: meLoaded && isAdmin },
  ].filter((x) => x.show !== false);

  const productionActive = productionItems.some((i) => i.href && isActive(pathname, i.href));
  const recutActive = recutItems.some((i) => i.href && isActive(pathname, i.href));
  const maintenanceActive = maintenanceItems.some((i) => i.href && isActive(pathname, i.href));
  const managerActive = managerItems.some((i) => i.href && isActive(pathname, i.href));
  const adminActive = adminItems.some((i) => i.href && isActive(pathname, i.href));

  const quickAction = useMemo(() => {
    if (pathname.startsWith("/daily-production")) {
      return { href: "/daily-production/add", label: "New Embroidery Entry" };
    }
    if (pathname.startsWith("/qc-daily-production")) {
      return { href: "/qc-daily-production/add", label: "New QC Entry" };
    }
    if (pathname.startsWith("/emblem-production")) {
      return { href: "/emblem-production/add", label: "New Emblem Entry" };
    }
    if (pathname.startsWith("/laser-production")) {
      return { href: "/laser-production/add", label: "New Laser Entry" };
    }
    if (pathname.startsWith("/recuts")) {
      if (!canSeeRecuts) return null;
      return { href: "/recuts/add", label: "New Recut Request" };
    }
    if (pathname.startsWith("/cmms/repair-requests")) {
      if (!canSeeRepairRequests) return null;
      return { href: "/cmms/repair-requests/add", label: "New Repair Request" };
    }
    if (pathname.startsWith("/cmms")) {
      if (!canSeeCMMS) return null;
      return { href: "/cmms/add", label: "New CMMS Work Order" };
    }
    return null;
  }, [pathname, canSeeRecuts, canSeeRepairRequests, canSeeCMMS]);

  function toggle(menu: OpenMenu) {
    setOpenMenu((cur) => (cur === menu ? null : menu));
  }

  const showHomeAsPrimary = navMode !== "small";
  const showRecutAsPrimary = navMode !== "small";
  const showMaintenanceAsPrimary = navMode === "wide";
  const showManagerAsPrimary = navMode === "wide";
  const showAdminAsPrimary = navMode === "wide";

  const showMore =
    navMode !== "wide" ||
    (!showRecutAsPrimary && recutItems.length > 0) ||
    (!showMaintenanceAsPrimary && maintenanceItems.length > 0) ||
    (!showManagerAsPrimary && managerItems.length > 0) ||
    (!showAdminAsPrimary && adminItems.length > 0);

  const moreSections = useMemo(() => {
    const sections: { title: string; items: MenuItem[] }[] = [];

    if (!showHomeAsPrimary) {
      sections.push({
        title: "Quick Links",
        items: [{ href: "/dashboard", label: "Home", show: true }],
      });
    }

    sections.push({ title: "Production", items: productionItems });

    if (!showRecutAsPrimary && recutItems.length > 0) {
      sections.push({ title: "Recut", items: recutItems });
    }

    if (!showMaintenanceAsPrimary && maintenanceItems.length > 0) {
      sections.push({ title: "Maintenance", items: maintenanceItems });
    }

    if (!showManagerAsPrimary && managerItems.length > 0) {
      sections.push({ title: "Manager", items: managerItems });
    }

    if (!showAdminAsPrimary && adminItems.length > 0) {
      sections.push({ title: "Admin", items: adminItems });
    }

    return sections;
  }, [
    showHomeAsPrimary,
    showRecutAsPrimary,
    showMaintenanceAsPrimary,
    showManagerAsPrimary,
    showAdminAsPrimary,
    productionItems,
    recutItems,
    maintenanceItems,
    managerItems,
    adminItems,
  ]);

  return (
    <nav style={nav}>
      <div ref={menusWrapRef} style={navInner}>
        <div style={left}>
          <Link href="/dashboard" style={brandWrap} title="Cap America - Cap Application Platform">
            <Image
              src="/brand/ca-mark.jpg"
              alt="Cap America"
              width={32}
              height={32}
              priority
              style={{ objectFit: "contain" }}
            />
            <span style={brandTitle}>CAP | Cap Application Platform</span>
          </Link>

          {showHomeAsPrimary ? <NavLink href="/dashboard" label="Home" pathname={pathname} /> : null}

          <Dropdown
            label="Production"
            active={productionActive}
            open={openMenu === "production"}
            onToggle={() => toggle("production")}
            items={productionItems}
            pathname={pathname}
            onNavigate={() => setOpenMenu(null)}
          />

          {showRecutAsPrimary ? (
            <Dropdown
              label="Recut"
              active={recutActive}
              open={openMenu === "recut"}
              onToggle={() => toggle("recut")}
              items={recutItems}
              pathname={pathname}
              onNavigate={() => setOpenMenu(null)}
              disabled={recutItems.length === 0}
            />
          ) : null}

          {showMaintenanceAsPrimary ? (
            <Dropdown
              label="Maintenance"
              active={maintenanceActive}
              open={openMenu === "maintenance"}
              onToggle={() => toggle("maintenance")}
              items={maintenanceItems}
              pathname={pathname}
              onNavigate={() => setOpenMenu(null)}
              disabled={maintenanceItems.length === 0}
            />
          ) : null}

          {showManagerAsPrimary ? (
            <Dropdown
              label="Manager"
              active={managerActive}
              open={openMenu === "manager"}
              onToggle={() => toggle("manager")}
              items={managerItems}
              pathname={pathname}
              onNavigate={() => setOpenMenu(null)}
              disabled={managerItems.length === 0}
            />
          ) : null}

          {showAdminAsPrimary ? (
            <Dropdown
              label="Admin"
              active={adminActive}
              open={openMenu === "admin"}
              onToggle={() => toggle("admin")}
              items={adminItems}
              pathname={pathname}
              onNavigate={() => setOpenMenu(null)}
              disabled={adminItems.length === 0}
            />
          ) : null}

          {showMore ? (
            <MoreMenu
              open={openMenu === "more"}
              active={
                (!showRecutAsPrimary && recutActive) ||
                (!showMaintenanceAsPrimary && maintenanceActive) ||
                (!showManagerAsPrimary && managerActive) ||
                (!showAdminAsPrimary && adminActive) ||
                (!showHomeAsPrimary && isActive(pathname, "/dashboard"))
              }
              onToggle={() => toggle("more")}
              sections={moreSections}
              pathname={pathname}
              onNavigate={() => setOpenMenu(null)}
            />
          ) : null}
        </div>

        <div style={right}>
          {meLoaded && canGlobalSearch ? (
            <div
              style={{
                ...searchWrap,
                width: searchFocused ? 360 : 240,
                transition: "width 0.2s ease",
              }}
              title="Global search (Admin/Manager)"
            >
              <input
                value={globalQ}
                onChange={(e) => setGlobalQ(e.target.value)}
                onKeyDown={onGlobalKeyDown}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                placeholder="Search SO, name, notes…"
                style={searchInput}
              />
              <button onClick={runGlobalSearch} style={searchBtn}>
                Search
              </button>
            </div>
          ) : null}

          {quickAction ? (
            <Link
              href={quickAction.href}
              style={quickActionBtn}
              title={quickAction.label}
              onClick={() => setOpenMenu(null)}
            >
              + New
            </Link>
          ) : null}

          <div style={{ position: "relative" }}>
            <button
              type="button"
              style={{
                ...userPillBtn,
                ...(openMenu === "user" ? pillOpen : {}),
              }}
              onClick={() => toggle("user")}
              aria-expanded={openMenu === "user"}
              aria-haspopup="menu"
              title="User menu"
            >
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <span style={userPillText}>{meLoaded ? display || "Unknown" : "…"}</span>
                <span style={chev} aria-hidden>
                  ▾
                </span>
              </span>
            </button>

            {openMenu === "user" ? (
              <div style={menuPanel} role="menu" aria-label="User menu">
                <div style={menuHeader}>
                  <div style={menuUserName}>{meLoaded ? display || "Unknown" : "…"}</div>
                  <div style={menuUserMeta}>{meLoaded ? (role ? role : "USER") : ""}</div>
                </div>

                <div style={menuDivider} />

                <Link
                  href="/logout"
                  role="menuitem"
                  style={menuItemDanger}
                  onClick={() => {
                    setMe(null);
                    setMeLoaded(false);
                    setOpenMenu(null);
                  }}
                >
                  Logout
                </Link>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </nav>
  );
}

function NavLink({ href, label, pathname }: { href: string; label: string; pathname: string }) {
  const active = isActive(pathname, href);
  return (
    <Link href={href} style={{ ...link, ...(active ? activeLink : {}) }}>
      {label}
    </Link>
  );
}

function Dropdown({
  label,
  items,
  pathname,
  open,
  active,
  disabled,
  onToggle,
  onNavigate,
}: {
  label: string;
  items: MenuItem[];
  pathname: string;
  open: boolean;
  active: boolean;
  disabled?: boolean;
  onToggle: () => void;
  onNavigate: () => void;
}) {
  const visibleItems = items.filter((it) => it.show !== false);

  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        style={{
          ...dropBtn,
          ...(active ? dropBtnActive : {}),
          ...(open ? dropBtnOpen : {}),
          ...(disabled ? dropBtnDisabled : {}),
        }}
        onClick={() => {
          if (disabled) return;
          onToggle();
        }}
        aria-expanded={open}
        aria-haspopup="menu"
        disabled={disabled}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          {label}
          <span style={chev} aria-hidden>
            ▾
          </span>
        </span>
      </button>

      {open ? (
        <div style={menuPanel} role="menu" aria-label={`${label} menu`}>
          {visibleItems.map((it, idx) => {
            if (it.kind === "section") {
              const hasPrevVisibleLink = visibleItems
                .slice(0, idx)
                .some((x) => x.kind !== "section");

              return (
                <div key={`section:${it.label}`}>
                  {hasPrevVisibleLink ? <div style={menuDivider} /> : null}
                  <div style={menuSectionTitle}>{it.label}</div>
                </div>
              );
            }

            const href = it.href || "#";
            const a = isActive(pathname, href);

            return (
              <Link
                key={href}
                href={href}
                role="menuitem"
                style={{ ...menuItem, ...(a ? menuItemActive : {}) }}
                onClick={onNavigate}
              >
                {it.label}
              </Link>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function MoreMenu({
  open,
  active,
  onToggle,
  sections,
  pathname,
  onNavigate,
}: {
  open: boolean;
  active: boolean;
  onToggle: () => void;
  sections: { title: string; items: MenuItem[] }[];
  pathname: string;
  onNavigate: () => void;
}) {
  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        style={{
          ...dropBtn,
          ...(active ? dropBtnActive : {}),
          ...(open ? dropBtnOpen : {}),
        }}
        onClick={onToggle}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          More
          <span style={chev} aria-hidden>
            ▾
          </span>
        </span>
      </button>

      {open ? (
        <div style={{ ...menuPanel, minWidth: 280 }} role="menu" aria-label="More menu">
          {sections.map((sec, idx) => (
            <div key={sec.title} style={{ padding: "6px 6px 2px 6px" }}>
              <div style={menuSectionTitle}>{sec.title}</div>

              <div style={{ marginTop: 4 }}>
                {sec.items
                  .filter((it) => it.show !== false)
                  .map((it, itemIdx, arr) => {
                    if (it.kind === "section") {
                      const hasPrevVisibleLink = arr.slice(0, itemIdx).some((x) => x.kind !== "section");
                      return (
                        <div key={`more-section:${sec.title}:${it.label}`}>
                          {hasPrevVisibleLink ? <div style={menuDivider} /> : null}
                          <div style={menuSectionTitle}>{it.label}</div>
                        </div>
                      );
                    }

                    const href = it.href || "#";
                    const a = isActive(pathname, href);

                    return (
                      <Link
                        key={`${sec.title}:${href}`}
                        href={href}
                        role="menuitem"
                        style={{ ...menuItem, ...(a ? menuItemActive : {}) }}
                        onClick={onNavigate}
                      >
                        {it.label}
                      </Link>
                    );
                  })}
              </div>

              {idx < sections.length - 1 ? <div style={menuDivider} /> : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/* ---------------------------- */
/* Styles                        */
/* ---------------------------- */

const nav: React.CSSProperties = {
  position: "sticky",
  top: 0,
  zIndex: 50,
  display: "flex",
  justifyContent: "center",
  padding: "10px 24px",
  background: "linear-gradient(180deg,#ffffff 0%,#f9fafb 100%)",
  borderBottom: "2px solid #b91c1c",
};

const navInner: React.CSSProperties = {
  width: "100%",
  maxWidth: 1600,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 16,
};

const left: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 4,
  flexShrink: 0,
};

const right: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  flexShrink: 0,
};

const brandWrap: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  marginRight: 8,
  textDecoration: "none",
  paddingRight: 14,
  borderRight: "1px solid #e5e7eb",
};

const brandTitle: React.CSSProperties = {
  fontWeight: 900,
  fontSize: 15,
  color: "#111827",
  letterSpacing: 0.2,
  whiteSpace: "nowrap",
};

const link: React.CSSProperties = {
  textDecoration: "none",
  padding: "7px 10px",
  borderRadius: 10,
  color: "#374151",
  fontWeight: 600,
  fontSize: 14,
  whiteSpace: "nowrap",
};

const activeLink: React.CSSProperties = {
  backgroundColor: "#111827",
  color: "#ffffff",
  fontWeight: 800,
};

const dropBtn: React.CSSProperties = {
  padding: "7px 10px",
  borderRadius: 10,
  border: "1px solid transparent",
  background: "transparent",
  color: "#374151",
  fontWeight: 600,
  fontSize: 14,
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const dropBtnActive: React.CSSProperties = {
  background: "#111827",
  color: "#ffffff",
  fontWeight: 800,
};

const dropBtnOpen: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
};

const dropBtnDisabled: React.CSSProperties = {
  opacity: 0.4,
  cursor: "not-allowed",
};

const chev: React.CSSProperties = {
  fontSize: 11,
  lineHeight: "11px",
  opacity: 0.7,
};

const quickActionBtn: React.CSSProperties = {
  textDecoration: "none",
  padding: "7px 14px",
  borderRadius: 999,
  border: "1px solid #111827",
  background: "#111827",
  color: "#ffffff",
  fontWeight: 700,
  fontSize: 13,
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const userPillBtn: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  background: "#ffffff",
  borderRadius: 999,
  padding: "7px 12px",
  cursor: "pointer",
  boxShadow: "0 1px 0 rgba(0,0,0,0.04)",
};

const pillOpen: React.CSSProperties = {
  border: "1px solid #cbd5e1",
  boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
};

const userPillText: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: "#111827",
  minWidth: 80,
  textAlign: "center",
};

const menuPanel: React.CSSProperties = {
  position: "absolute",
  top: "calc(100% + 8px)",
  right: 0,
  minWidth: 260,
  background: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  boxShadow: "0 12px 28px rgba(0,0,0,0.12)",
  padding: 8,
  zIndex: 100,
  maxHeight: "70vh",
  overflowY: "auto",
};

const menuHeader: React.CSSProperties = {
  padding: "8px 10px",
};

const menuUserName: React.CSSProperties = {
  fontWeight: 800,
  fontSize: 13,
  color: "#111827",
};

const menuUserMeta: React.CSSProperties = {
  marginTop: 2,
  fontWeight: 600,
  fontSize: 11,
  color: "#6b7280",
};

const menuDivider: React.CSSProperties = {
  height: 1,
  background: "#e5e7eb",
  margin: "6px 0",
};

const menuSectionTitle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: "#9ca3af",
  textTransform: "uppercase",
  letterSpacing: 0.6,
  padding: "4px 6px 2px 6px",
};

const menuItem: React.CSSProperties = {
  display: "block",
  textDecoration: "none",
  padding: "9px 10px",
  borderRadius: 10,
  color: "#111827",
  fontWeight: 600,
  fontSize: 13,
};

const menuItemActive: React.CSSProperties = {
  background: "#f3f4f6",
  fontWeight: 700,
};

const menuItemDanger: React.CSSProperties = {
  ...menuItem,
  color: "#b91c1c",
  background: "#fff5f5",
  border: "1px solid #fecaca",
};

const searchWrap: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  padding: "4px 4px 4px 10px",
  borderRadius: 999,
  border: "1px solid #e5e7eb",
  background: "#ffffff",
  boxShadow: "0 1px 0 rgba(0,0,0,0.04)",
  overflow: "hidden",
};

const searchInput: React.CSSProperties = {
  border: "none",
  outline: "none",
  fontSize: 13,
  padding: "4px 0",
  flex: 1,
  minWidth: 0,
  color: "#111827",
  background: "transparent",
};

const searchBtn: React.CSSProperties = {
  height: 28,
  padding: "0 12px",
  borderRadius: 999,
  border: "1px solid #111827",
  background: "#111827",
  color: "#fff",
  fontWeight: 700,
  fontSize: 12,
  cursor: "pointer",
  flexShrink: 0,
};