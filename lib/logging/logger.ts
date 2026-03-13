import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getAuthFromRequest } from "@/lib/auth";

export type LogLevel = "INFO" | "WARN" | "ERROR" | "SECURITY" | "AUDIT";
export type LogCategory = "APP" | "API" | "AUTH" | "SECURITY" | "AUDIT";

export type LoggerContext = {
  level: LogLevel;
  category: LogCategory;

  eventType?: string | null;
  message?: string | null;

  module?: string | null;
  route?: string | null;
  method?: string | null;

  username?: string | null;
  employeeNumber?: number | null;
  role?: string | null;

  recordType?: string | null;
  recordId?: string | number | null;

  ipAddress?: string | null;
  userAgent?: string | null;

  details?: unknown;

  req?: NextRequest | Request | null;
  auth?: any | null;
  error?: unknown;
};

type SafeAuth = {
  username: string | null;
  employeeNumber: number | null;
  role: string | null;
};

function toNullableString(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s ? s : null;
}

function toNullableInt(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sanitizeForJson(value: unknown, depth = 0): unknown {
  if (depth > 6) return "[MaxDepthExceeded]";
  if (value === undefined) return null;
  if (value === null) return null;
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack ?? null,
    };
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeForJson(item, depth + 1));
  }
  if (isObject(value)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = sanitizeForJson(v, depth + 1);
    }
    return out;
  }
  return String(value);
}

function normalizeError(error: unknown): Record<string, unknown> | null {
  if (!error) return null;

  if (error instanceof Error) {
    const maybeAny = error as any;
    return {
      name: error.name,
      message: error.message,
      stack: error.stack ?? null,
      code: maybeAny?.code ?? null,
      detail: maybeAny?.detail ?? null,
      hint: maybeAny?.hint ?? null,
      severity: maybeAny?.severity ?? null,
      constraint: maybeAny?.constraint ?? null,
      table: maybeAny?.table ?? null,
      column: maybeAny?.column ?? null,
      schema: maybeAny?.schema ?? null,
    };
  }

  if (isObject(error)) {
    return sanitizeForJson(error) as Record<string, unknown>;
  }

  return { message: String(error) };
}

function getHeader(req: Request | null | undefined, key: string): string | null {
  try {
    return toNullableString(req?.headers?.get(key));
  } catch {
    return null;
  }
}

function getClientIp(req: Request | null | undefined): string | null {
  const forwardedFor = getHeader(req, "x-forwarded-for");
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) return first;
  }

  return (
    getHeader(req, "x-real-ip") ||
    getHeader(req, "cf-connecting-ip") ||
    getHeader(req, "true-client-ip") ||
    null
  );
}

async function resolveAuth(
  req?: NextRequest | Request | null,
  auth?: any | null
): Promise<SafeAuth> {
  if (auth) {
    return {
      username:
        toNullableString(auth.username) ??
        toNullableString(auth.userName) ??
        toNullableString(auth.displayName),
      employeeNumber: toNullableInt(
        auth.employeeNumber ?? auth.employee_number ?? auth.empNumber
      ),
      role: toNullableString(auth.role),
    };
  }

  if (!req) {
    return {
      username: null,
      employeeNumber: null,
      role: null,
    };
  }

  try {
    const maybeAuth = await Promise.resolve(getAuthFromRequest(req as any));
    return {
      username:
        toNullableString((maybeAuth as any)?.username) ??
        toNullableString((maybeAuth as any)?.userName) ??
        toNullableString((maybeAuth as any)?.displayName),
      employeeNumber: toNullableInt(
        (maybeAuth as any)?.employeeNumber ??
          (maybeAuth as any)?.employee_number ??
          (maybeAuth as any)?.empNumber
      ),
      role: toNullableString((maybeAuth as any)?.role),
    };
  } catch {
    return {
      username: null,
      employeeNumber: null,
      role: null,
    };
  }
}

function mergeDetails(details: unknown, error: unknown): unknown {
  const normalizedError = normalizeError(error);

  if (!normalizedError) {
    return sanitizeForJson(details);
  }

  if (!details) {
    return { error: normalizedError };
  }

  if (isObject(details)) {
    return sanitizeForJson({
      ...details,
      error: normalizedError,
    });
  }

  return sanitizeForJson({
    details,
    error: normalizedError,
  });
}

/**
 * Core logger.
 * Safe by design: logging failures should never break the main request flow.
 */
export async function writeLog(ctx: LoggerContext): Promise<void> {
  try {
    const req = ctx.req ?? null;
    const auth = await resolveAuth(req, ctx.auth);

    const route =
      toNullableString(ctx.route) ||
      (req && "url" in req
        ? (() => {
            try {
              const u = new URL(req.url);
              return toNullableString(u.pathname);
            } catch {
              return null;
            }
          })()
        : null);

    const method =
      toNullableString(ctx.method) ||
      ("method" in (req ?? {}) ? toNullableString((req as Request).method) : null);

    const ipAddress = toNullableString(ctx.ipAddress) || getClientIp(req);
    const userAgent = toNullableString(ctx.userAgent) || getHeader(req, "user-agent");

    const payload = {
      level: ctx.level,
      category: ctx.category,
      eventType: toNullableString(ctx.eventType),
      message: toNullableString(ctx.message),
      module: toNullableString(ctx.module),
      route,
      method,

      username: toNullableString(ctx.username) ?? auth.username,
      employeeNumber: toNullableInt(ctx.employeeNumber) ?? auth.employeeNumber,
      role: toNullableString(ctx.role) ?? auth.role,

      recordType: toNullableString(ctx.recordType),
      recordId: toNullableString(ctx.recordId),

      ipAddress,
      userAgent,

      detailsJson: mergeDetails(ctx.details, ctx.error),
    };

    await db.query(
      `
        INSERT INTO app_logs (
          level,
          category,
          event_type,
          message,
          module,
          route,
          method,
          username,
          employee_number,
          role,
          record_type,
          record_id,
          ip_address,
          user_agent,
          details_json
        )
        VALUES (
          $1,  $2,  $3,  $4,  $5,
          $6,  $7,  $8,  $9,  $10,
          $11, $12, $13, $14, $15::jsonb
        )
      `,
      [
        payload.level,
        payload.category,
        payload.eventType,
        payload.message,
        payload.module,
        payload.route,
        payload.method,
        payload.username,
        payload.employeeNumber,
        payload.role,
        payload.recordType,
        payload.recordId,
        payload.ipAddress,
        payload.userAgent,
        JSON.stringify(payload.detailsJson ?? null),
      ]
    );
  } catch (loggingError) {
    // Intentionally swallow logging failures so app behavior is never blocked.
    // Keep a console fallback for local troubleshooting.
    console.error("[logger] failed to write app log", loggingError);
  }
}

export async function logInfo(
  ctx: Omit<LoggerContext, "level" | "category"> & {
    category?: LogCategory;
  }
): Promise<void> {
  await writeLog({
    ...ctx,
    level: "INFO",
    category: ctx.category ?? "APP",
  });
}

export async function logWarn(
  ctx: Omit<LoggerContext, "level" | "category"> & {
    category?: LogCategory;
  }
): Promise<void> {
  await writeLog({
    ...ctx,
    level: "WARN",
    category: ctx.category ?? "APP",
  });
}

export async function logError(
  ctx: Omit<LoggerContext, "level" | "category"> & {
    category?: LogCategory;
  }
): Promise<void> {
  await writeLog({
    ...ctx,
    level: "ERROR",
    category: ctx.category ?? "API",
  });
}

export async function logSecurityEvent(
  ctx: Omit<LoggerContext, "level" | "category"> & {
    category?: "AUTH" | "SECURITY";
  }
): Promise<void> {
  await writeLog({
    ...ctx,
    level: "SECURITY",
    category: ctx.category ?? "SECURITY",
  });
}

export async function logAuditEvent(
  ctx: Omit<LoggerContext, "level" | "category"> & {
    category?: "AUDIT";
  }
): Promise<void> {
  await writeLog({
    ...ctx,
    level: "AUDIT",
    category: "AUDIT",
  });
}