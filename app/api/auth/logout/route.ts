import { NextResponse } from "next/server";

export async function GET(req: Request) {
  // Redirect back to login after clearing cookie
  const url = new URL(req.url);
  const redirectTo = url.searchParams.get("redirect") || "/login";

  const res = NextResponse.redirect(new URL(redirectTo, req.url), 302);

  // Clear the auth cookie (match your cookie name)
  res.cookies.set({
    name: "auth_token",
    value: "",
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 0,
  });

  return res;
}
