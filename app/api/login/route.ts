import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, loginUser } from "@/lib/auth";

type LoginResponse = { success: boolean; message?: string };

function methodNotAllowed() {
  return NextResponse.json<LoginResponse>(
    { success: false, message: "Method not allowed" },
    { status: 405 }
  );
}

export async function GET() {
  return methodNotAllowed();
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const username = typeof body?.username === "string" ? body.username.trim() : "";
    const password = typeof body?.password === "string" ? body.password : "";

    if (!username || !password) {
      return NextResponse.json<LoginResponse>(
        { success: false, message: "Missing credentials" },
        { status: 400 }
      );
    }

    const result = await loginUser(username, password);

    if ("error" in result) {
      return NextResponse.json<LoginResponse>(
        { success: false, message: "Invalid username or password" },
        { status: 401 }
      );
    }

    const response = NextResponse.json<LoginResponse>({ success: true }, { status: 200 });
    response.cookies.set(COOKIE_NAME, result.token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 8,
      secure: process.env.NODE_ENV === "production",
    });

    return response;
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json<LoginResponse>(
      {
        success: false,
        message: error instanceof Error ? error.message : "Login failed",
      },
      { status: 500 }
    );
  }
}
