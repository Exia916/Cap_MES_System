import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, getAuthFromRequest } from "@/lib/auth";
import { logError, logSecurityEvent } from "@/lib/logging/logger";

function buildLogoutResponse() {
  const response = NextResponse.json({ success: true });

  response.cookies.set(COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(0),
  });

  return response;
}

async function handleLogout(req: NextRequest) {
  try {
    const auth = getAuthFromRequest(req);

    await logSecurityEvent({
      req,
      auth,
      category: "AUTH",
      module: "AUTH",
      eventType: "LOGOUT",
      message: "User logged out",
    });

    return buildLogoutResponse();
  } catch (error) {
    await logError({
      req,
      category: "AUTH",
      module: "AUTH",
      eventType: "LOGOUT_ERROR",
      message: "Logout route failed unexpectedly",
      error,
    });

    console.error("Logout error:", error);

    return buildLogoutResponse();
  }
}

export async function GET(req: NextRequest) {
  return handleLogout(req);
}

export async function POST(req: NextRequest) {
  return handleLogout(req);
}