import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, getAuthFromRequest } from "@/lib/auth";
import { logError, logSecurityEvent } from "@/lib/logging/logger";

const LEGACY_COOKIE_NAME = "token";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const redirectTo = url.searchParams.get("redirect") || "/login";

    const auth = getAuthFromRequest(req);

    await logSecurityEvent({
      req,
      auth,
      category: "AUTH",
      module: "AUTH",
      eventType: "LOGOUT",
      message: "User logged out",
    });

    const res = NextResponse.redirect(new URL(redirectTo, req.url), 302);

    const cookieOptions = {
      path: "/",
      httpOnly: true,
      sameSite: "lax" as const,
      secure: process.env.NODE_ENV === "production",
      maxAge: 0,
    };

    res.cookies.set({
      name: COOKIE_NAME,
      value: "",
      ...cookieOptions,
    });

    res.cookies.set({
      name: LEGACY_COOKIE_NAME,
      value: "",
      ...cookieOptions,
    });

    return res;
  } catch (error) {
    await logError({
      req,
      category: "AUTH",
      module: "AUTH",
      eventType: "LOGOUT_ERROR",
      message: "Logout route failed unexpectedly",
      error,
    });

    const url = new URL(req.url);
    const redirectTo = url.searchParams.get("redirect") || "/login";
    const res = NextResponse.redirect(new URL(redirectTo, req.url), 302);

    res.cookies.set({
      name: COOKIE_NAME,
      value: "",
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 0,
    });

    res.cookies.set({
      name: LEGACY_COOKIE_NAME,
      value: "",
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 0,
    });

    return res;
  }
}