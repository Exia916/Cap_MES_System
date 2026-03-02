// app/api/admin/users/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyJwt } from "@/lib/auth";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";

export const runtime = "nodejs";

async function requireAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) return { ok: false as const, status: 401, error: "Unauthorized" };

  const payload: any = verifyJwt(token);
  if (!payload) return { ok: false as const, status: 401, error: "Unauthorized" };

  const role = String(payload.role || "").toUpperCase();
  if (role !== "ADMIN") {
    return { ok: false as const, status: 403, error: "Forbidden" };
  }

  return { ok: true as const, payload };
}

function normUpperOrNull(v: any) {
  const s = String(v ?? "").trim();
  return s ? s.toUpperCase() : null;
}

function normTextOrNull(v: any) {
  const s = String(v ?? "").trim();
  return s ? s : null;
}

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const res = await db.query(`
      SELECT
        id,
        username,
        display_name,
        name,
        employee_number,
        role::text AS role,
        is_active,
        shift,
        department,
        created_at,
        updated_at
      FROM users
      ORDER BY username ASC
    `);

    return NextResponse.json({ users: res.rows });
  } catch (err: any) {
    console.error("GET /api/admin/users failed:", err);
    return NextResponse.json(
      {
        error:
          process.env.NODE_ENV === "production"
            ? "Failed to load users"
            : err?.message || "Failed to load users",
      },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = (await req.json().catch(() => null)) as any;
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const username = normTextOrNull(body.username);
  const password = String(body.password ?? "");
  const display_name = normTextOrNull(body.display_name);
  const name = normTextOrNull(body.name);

  const employee_number =
    body.employee_number === null || body.employee_number === undefined || body.employee_number === ""
      ? null
      : Number(body.employee_number);

  const role = normUpperOrNull(body.role) || "USER";
  const shift = normUpperOrNull(body.shift); // store code
  const department = normUpperOrNull(body.department); // store code
  const is_active = body.is_active === undefined ? true : Boolean(body.is_active);

  if (!username || !password || !role) {
    return NextResponse.json(
      { error: "Username, password, and role are required." },
      { status: 400 }
    );
  }

  try {
    const password_hash = await bcrypt.hash(password, 10);

    const res = await db.query(
      `
      INSERT INTO users (
        username,
        password_hash,
        display_name,
        name,
        employee_number,
        role,
        shift,
        department,
        is_active
      )
      VALUES ($1, $2, $3, $4, $5, $6::role, $7, $8, $9)
      RETURNING
        id,
        username,
        display_name,
        name,
        employee_number,
        role::text AS role,
        is_active,
        shift,
        department,
        created_at,
        updated_at
      `,
      [
        username,
        password_hash,
        display_name,
        name,
        employee_number,
        role,
        shift,
        department,
        is_active,
      ]
    );

    return NextResponse.json({ user: res.rows[0] });
  } catch (err: any) {
    console.error("POST /api/admin/users failed:", err);

    const msg =
      String(err?.message || "").toLowerCase().includes("duplicate") ||
      String(err?.message || "").toLowerCase().includes("unique")
        ? "That username already exists."
        : process.env.NODE_ENV === "production"
        ? "Failed to create user"
        : err?.message || "Failed to create user";

    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = (await req.json().catch(() => null)) as any;
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const id = String(body.id ?? "").trim();
  if (!id) return NextResponse.json({ error: "Missing user id" }, { status: 400 });

  const username = normTextOrNull(body.username);
  const display_name = normTextOrNull(body.display_name);
  const name = normTextOrNull(body.name);

  const employee_number =
    body.employee_number === null || body.employee_number === undefined || body.employee_number === ""
      ? null
      : Number(body.employee_number);

  const role = normUpperOrNull(body.role) || "USER";
  const shift = normUpperOrNull(body.shift); // store code
  const department = normUpperOrNull(body.department); // store code
  const is_active = body.is_active === undefined ? true : Boolean(body.is_active);

  const new_password = String(body.new_password ?? "").trim();

  if (!username || !role) {
    return NextResponse.json({ error: "Username and role are required." }, { status: 400 });
  }

  try {
    if (new_password) {
      const password_hash = await bcrypt.hash(new_password, 10);

      const res = await db.query(
        `
        UPDATE users
        SET
          username = $1,
          display_name = $2,
          name = $3,
          employee_number = $4,
          role = $5::role,
          shift = $6,
          department = $7,
          is_active = $8,
          password_hash = $9,
          updated_at = NOW()
        WHERE id = $10
        `,
        [
          username,
          display_name,
          name,
          employee_number,
          role,
          shift,
          department,
          is_active,
          password_hash,
          id,
        ]
      );

      if (res.rowCount === 0) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      return NextResponse.json({ success: true });
    }

    const res = await db.query(
      `
      UPDATE users
      SET
        username = $1,
        display_name = $2,
        name = $3,
        employee_number = $4,
        role = $5::role,
        shift = $6,
        department = $7,
        is_active = $8,
        updated_at = NOW()
      WHERE id = $9
      `,
      [username, display_name, name, employee_number, role, shift, department, is_active, id]
    );

    if (res.rowCount === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("PUT /api/admin/users failed:", err);

    const msg =
      String(err?.message || "").toLowerCase().includes("duplicate") ||
      String(err?.message || "").toLowerCase().includes("unique")
        ? "That username already exists."
        : process.env.NODE_ENV === "production"
        ? "Failed to update user"
        : err?.message || "Failed to update user";

    return NextResponse.json({ error: msg }, { status: 500 });
  }
}