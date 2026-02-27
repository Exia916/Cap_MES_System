// app/api/me/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";

type MeResponse = {
  username?: string | null;
  displayName?: string | null;
  employeeNumber?: number | null;
  role?: string | null;
  error?: string;
};

export async function GET(req: NextRequest) {
  const auth: any = getAuthFromRequest(req);

  if (!auth) {
    return NextResponse.json<MeResponse>({ error: "Not authenticated" }, { status: 401 });
  }

  // Try common shapes without breaking if your auth object differs
  const username = auth.username ?? null;
  const displayName = auth.displayName ?? auth.display_name ?? null;

  // Your previous code used auth.userId as "employeeNumber". Keep compatibility.
  const employeeNumberRaw = auth.employeeNumber ?? auth.employee_number ?? auth.userId ?? auth.user_id ?? null;
  const employeeNumber =
    employeeNumberRaw === null || employeeNumberRaw === undefined
      ? null
      : Number.isFinite(Number(employeeNumberRaw))
        ? Number(employeeNumberRaw)
        : null;

  const role = auth.role ?? auth.userRole ?? auth.user_role ?? null;

  return NextResponse.json<MeResponse>(
    {
      username,
      displayName,
      employeeNumber,
      role,
    },
    { status: 200 }
  );
}