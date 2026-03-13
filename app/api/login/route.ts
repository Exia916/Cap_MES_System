import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, loginUser } from "@/lib/auth";
import { logError, logSecurityEvent } from "@/lib/logging/logger";

type LoginResponse = { success: boolean; message?: string };

function methodNotAllowed() {
  return NextResponse.json<LoginResponse>(
    { success: false, message: "Method not allowed" },
    { status: 405 }
  );
}

function getSafeUsername(body: any): string {
  return typeof body?.username === "string" ? body.username.trim() : "";
}

function getSafePassword(body: any): string {
  return typeof body?.password === "string" ? body.password : "";
}

export async function GET() {
  return methodNotAllowed();
}

export async function POST(req: NextRequest) {
  let username = "";

  try {
    const body = await req.json();
    username = getSafeUsername(body);
    const password = getSafePassword(body);

    if (!username || !password) {
      await logSecurityEvent({
        req,
        category: "AUTH",
        module: "AUTH",
        eventType: "LOGIN_MISSING_CREDENTIALS",
        message: "Login attempt rejected due to missing credentials",
        username: username || null,
        details: {
          hasUsername: Boolean(username),
          hasPassword: Boolean(password),
        },
      });

      return NextResponse.json<LoginResponse>(
        { success: false, message: "Missing credentials" },
        { status: 400 }
      );
    }

    const result = await loginUser(username, password);

    if ("error" in result) {
      await logSecurityEvent({
        req,
        category: "AUTH",
        module: "AUTH",
        eventType: "LOGIN_FAILED",
        message: "Invalid username or password",
        username,
        details: {
          reason: "INVALID_CREDENTIALS",
        },
      });

      return NextResponse.json<LoginResponse>(
        { success: false, message: "Invalid username or password" },
        { status: 401 }
      );
    }

    await logSecurityEvent({
      req,
      category: "AUTH",
      module: "AUTH",
      eventType: "LOGIN_SUCCESS",
      message: "User login succeeded",
      username: result.username ?? username,
      employeeNumber:
        typeof result.employeeNumber === "number" ? result.employeeNumber : null,
      role: result.role ?? null,
      details: {
        displayName: result.displayName ?? null,
      },
    });

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
    await logError({
      req,
      category: "AUTH",
      module: "AUTH",
      eventType: "LOGIN_ERROR",
      message: "Login route failed unexpectedly",
      username: username || null,
      error,
    });

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