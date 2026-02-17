import { NextResponse } from "next/server";
import { COOKIE_NAME } from "@/lib/auth";

function clearAuthCookie() {
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

export async function GET() {
  return clearAuthCookie();
}

export async function POST() {
  return clearAuthCookie();
}
