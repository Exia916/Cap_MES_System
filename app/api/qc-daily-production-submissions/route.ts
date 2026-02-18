import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import { listQCSubmissionsForUserAndSO } from "@/lib/repositories/qcRepo";

function toInt(value: string): number | null {
  const t = value.trim();
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n) || !Number.isInteger(n)) return null;
  return n;
}

export async function GET(req: NextRequest) {
  const auth = await getAuthFromRequest(req as any);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const soRaw = req.nextUrl.searchParams.get("salesOrder") ?? "";
  const so = toInt(soRaw);
  if (so == null) return NextResponse.json({ submissions: [] }, { status: 200 });

  const submissions = await listQCSubmissionsForUserAndSO({
    employeeNumber: Number(auth.employeeNumber),
    salesOrder: so,
  });

  return NextResponse.json({ submissions }, { status: 200 });
}
