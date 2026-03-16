import { NextRequest, NextResponse } from "next/server";

const PUBLIC_PATHS = new Set([
  "/login",
  "/api/auth/login",
  "/api/auth/login/me",
  "/api/auth/logout",
  "/favicon.ico",
  "/robots.txt",
  "/sitemap.xml",
]);

function isPublicPath(pathname: string) {
  if (PUBLIC_PATHS.has(pathname)) return true;
  if (pathname.startsWith("/_next")) return true;
  if (/\.[^/]+$/.test(pathname)) return true;
  return false;
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length < 2) return null;
  const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");

  try {
    const json = atob(padded);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function getRole(payload: Record<string, unknown> | null) {
  const r = String((payload as any)?.role || "").trim().toUpperCase();
  return r;
}

/* -------------------------------------------------------------------------- */
/* CMMS MASTER DATA KEYS                                                      */
/* -------------------------------------------------------------------------- */

const CMMS_MASTER_KEYS = new Set([
  "priorities",
  "statuses",
  "issue_catalog",
  "techs",
  "wo_types",
  "cmms_departments",
  "cmms_assets",
]);

function isCmmsMasterPath(pathname: string) {
  const parts = pathname.split("/");

  const idx = parts.indexOf("master-data");
  if (idx === -1) return false;

  const key = parts[idx + 1];
  return CMMS_MASTER_KEYS.has(key);
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const token = request.cookies.get("auth_token")?.value;

  if (!token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const payload = decodeJwtPayload(token);
  const role = getRole(payload);

  /* -------------------------------------------------------------------------- */
  /* ADMIN ROUTES                                                               */
  /* -------------------------------------------------------------------------- */

  if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) {
    const isCmmsMaster = isCmmsMasterPath(pathname);

    if (isCmmsMaster) {
      const allowed = new Set(["ADMIN", "TECH"]);
      if (!payload || !allowed.has(role)) {
        return NextResponse.redirect(new URL("/dashboard", request.url));
      }
    } else {
      if (!payload || role !== "ADMIN") {
        return NextResponse.redirect(new URL("/login", request.url));
      }
    }
  }

  /* -------------------------------------------------------------------------- */
  /* CMMS MODULE                                                                */
  /* -------------------------------------------------------------------------- */

  if (pathname.startsWith("/cmms") || pathname.startsWith("/api/cmms")) {
    const allowed = new Set(["ADMIN", "MANAGER", "SUPERVISOR", "TECH"]);

    if (!payload || !allowed.has(role)) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/:path*",
};