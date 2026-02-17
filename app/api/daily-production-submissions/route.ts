import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import { listEmbroiderySubmissionsForUserAndSO } from "@/lib/repositories/embroideryRepo";

export async function GET(req: NextRequest) {
  const auth = await getAuthFromRequest(req as any);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const salesOrderRaw = req.nextUrl.searchParams.get("salesOrder")?.trim() ?? "";
  const salesOrder = Number(salesOrderRaw);
  if (!Number.isFinite(salesOrder) || !Number.isInteger(salesOrder)) {
    return NextResponse.json({ error: "Invalid salesOrder" }, { status: 400 });
  }

  try {
    const employeeNumber = Number(auth.employeeNumber);
    if (!Number.isFinite(employeeNumber)) throw new Error("employeeNumber missing");

    const submissions = await listEmbroiderySubmissionsForUserAndSO({
      employeeNumber,
      salesOrder,
    });

    return NextResponse.json({ submissions }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Server error" }, { status: 500 });
  }
}

