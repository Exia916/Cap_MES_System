import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import { db } from "@/lib/db";

type UserRow = {
  id: string;
  username: string;
  displayName: string;
  employeeNumber: number;
};

type Resp = { users: UserRow[] } | { error: string };

export async function GET(req: NextRequest) {
  const auth = getAuthFromRequest(req);
  if (!auth) return NextResponse.json<Resp>({ error: "Unauthorized" }, { status: 401 });

  try {
    const result = await db.query<UserRow>(`
      SELECT
        id,
        username,
        display_name AS "displayName",
        employee_number AS "employeeNumber"
      FROM users
      ORDER BY display_name ASC
    `);

    return NextResponse.json<Resp>({ users: result.rows }, { status: 200 });
  } catch (err) {
    console.error("users GET error:", err);
    return NextResponse.json<Resp>({ error: "Server error" }, { status: 500 });
  }
}
