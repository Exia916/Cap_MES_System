import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import { listQCSubmissionsForUserAndSO } from "@/lib/repositories/qcRepo";
import { normalizeSalesOrder } from "@/lib/utils/salesOrder";

export async function GET(req: NextRequest) {
  const auth = await getAuthFromRequest(req as any);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rawSalesOrder = req.nextUrl.searchParams.get("salesOrder") ?? "";
  const normalizedSO = normalizeSalesOrder(rawSalesOrder);

  if (!normalizedSO.isValid || !normalizedSO.salesOrderBase) {
    return NextResponse.json({ submissions: [] }, { status: 200 });
  }

  const submissions = await listQCSubmissionsForUserAndSO({
    employeeNumber: Number(auth.employeeNumber),
    salesOrderBase: normalizedSO.salesOrderBase,
  });

  return NextResponse.json({ submissions }, { status: 200 });
}