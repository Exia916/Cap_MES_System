// lib/auth.ts

import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import type { NextRequest } from "next/server";
import type { NextApiRequest, NextApiResponse } from "next";
import { getUserByUsername } from "@/lib/repositories/usersRepo";

export const COOKIE_NAME = "auth_token";

const JWT_SECRET = process.env.JWT_SECRET as string;
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is not defined.");
}

/* -------------------------------------------------------------------------- */
/*                                   TYPES                                    */
/* -------------------------------------------------------------------------- */

export type AuthUser = {
  id: string;
  username: string;
  name: string; // maps from display_name
  employeeNumber: number;
  role: string;
  shift: string;
  department: string;
};

export type AuthUserWithLegacy = AuthUser & {
  displayName: string;
  userId: string;
};

/* -------------------------------------------------------------------------- */
/*                                   JWT                                      */
/* -------------------------------------------------------------------------- */

function signJwt(payload: AuthUser) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "8h" });
}

export function verifyJwt(token: string): AuthUser | null {
  try {
    return jwt.verify(token, JWT_SECRET) as AuthUser;
  } catch {
    return null;
  }
}

function withLegacyAliases(user: AuthUser): AuthUserWithLegacy {
  return {
    ...user,
    displayName: user.name,
    userId: String(user.employeeNumber),
  };
}

/* -------------------------------------------------------------------------- */
/*                                   LOGIN                                    */
/* -------------------------------------------------------------------------- */

export async function loginUser(username: string, password: string) {
  const user = await getUserByUsername(username);

  if (!user || user.is_active === false) {
    return { error: "Invalid credentials." };
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    return { error: "Invalid credentials." };
  }

  const authUser: AuthUser = {
    id: user.id,
    username: user.username,
    name: user.display_name,
    employeeNumber: Number(user.employee_number),
    role: user.role,
    shift: user.shift,
    department: user.department,
  };

  const token = signJwt(authUser);

  return { token, user: authUser };
}

/* -------------------------------------------------------------------------- */
/*                           REQUEST HELPERS                                  */
/* -------------------------------------------------------------------------- */

function getTokenFromRequest(req: NextRequest | NextApiRequest): string | null {
  const candidate = (req as NextRequest).cookies;
  if (candidate && typeof (candidate as { get?: unknown }).get === "function") {
    return (candidate as { get: (name: string) => { value: string } | undefined })
      .get(COOKIE_NAME)
      ?.value ?? null;
  }

  const cookiesObj = (req as NextApiRequest).cookies;
  if (!cookiesObj) return null;
  const token = cookiesObj[COOKIE_NAME];
  return typeof token === "string" && token.length > 0 ? token : null;
}

export function getAuthFromRequest(req: NextRequest | NextApiRequest): AuthUserWithLegacy | null {
  const token = getTokenFromRequest(req);
  if (!token) return null;
  const payload = verifyJwt(token);
  if (!payload) return null;
  return withLegacyAliases(payload);
}

export function requireRole(req: NextRequest | NextApiRequest, roles: string[]) {
  const user = getAuthFromRequest(req);
  if (!user) throw new Error("Unauthorized");
  if (!roles.includes(user.role)) throw new Error("Forbidden");
  return user;
}

export function setAuthCookie(res: NextApiResponse, token: string) {
  const secure = process.env.NODE_ENV === "production";
  res.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=28800${secure ? "; Secure" : ""}`
  );
}

export function clearAuthCookie(res: NextApiResponse) {
  const secure = process.env.NODE_ENV === "production";
  res.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Expires=Thu, 01 Jan 1970 00:00:00 GMT${secure ? "; Secure" : ""}`
  );
}
