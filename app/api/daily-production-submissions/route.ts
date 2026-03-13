import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import { listEmbroiderySubmissionsForUserAndSO } from "@/lib/repositories/embroideryRepo";
import { normalizeSalesOrder } from "@/lib/utils/salesOrder";

export async function GET(req: NextRequest) {
  const auth = await getAuthFromRequest(req as any);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rawSalesOrder = req.nextUrl.searchParams.get("salesOrder") ?? "";
  const normalizedSO = normalizeSalesOrder(rawSalesOrder);

  if (!normalizedSO.isValid || !normalizedSO.salesOrderBase) {
    return NextResponse.json({ submissions: [] }, { status: 200 });
  }

  try {
    const employeeNumber = Number(auth.employeeNumber);
    if (!Number.isFinite(employeeNumber)) throw new Error("employeeNumber missing");

    const submissions = await listEmbroiderySubmissionsForUserAndSO({
      employeeNumber,
      salesOrderBase: normalizedSO.salesOrderBase,
    });

    return NextResponse.json({ submissions }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Server error" }, { status: 500 });
  }
}