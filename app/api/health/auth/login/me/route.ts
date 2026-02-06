import { NextRequest, NextResponse } from "next/server";
import { verifyJwt } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const token = req.cookies.get("auth_token")?.value;
  if (!token) {
    return NextResponse.json({ user: null });
  }

  const payload = verifyJwt(token);
  if (!payload) {
    return NextResponse.json({ user: null });
  }

  return NextResponse.json({
    user: {
      id: payload.userId,
      role: payload.role,
    },
  });
}
