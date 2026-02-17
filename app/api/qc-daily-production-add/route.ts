import { NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import { addQCDailyEntry } from "@/lib/repositories/qcRepo";

function toNullableInt(value: unknown): number | null {
  const raw = (value ?? "").toString().trim();
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || !Number.isInteger(n)) return null;
  return n;
}

function toNonNegIntOrNull(value: unknown, fieldLabel: string): number | null {
  const raw = (value ?? "").toString().trim();
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) {
    throw new Error(`${fieldLabel} must be a non-negative integer.`);
  }
  return n;
}

export async function POST(req: Request) {
  try {
    const auth = await getAuthFromRequest(req as any);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const name = auth.displayName ?? auth.username ?? "";
    const employeeNumber = Number(auth.employeeNumber);
    if (!name) throw new Error("Authenticated user name not found.");
    if (!Number.isFinite(employeeNumber)) throw new Error("Authenticated employeeNumber not found.");

    const body = await req.json();

    const entryTs = new Date(body.entryTs ?? new Date().toISOString());
    if (Number.isNaN(entryTs.getTime())) throw new Error("entryTs is invalid.");

    const inserted = await addQCDailyEntry({
      entryTs,
      name,
      employeeNumber,

      salesOrder: toNullableInt(body.salesOrder),
      detailNumber: toNullableInt(body.detailNumber),
      flatOr3d: (body.flatOr3d ?? "").toString().trim() || null,

      orderQuantity: toNonNegIntOrNull(body.orderQuantity, "orderQuantity"),
      inspectedQuantity: toNonNegIntOrNull(body.inspectedQuantity, "inspectedQuantity"),
      rejectedQuantity: toNonNegIntOrNull(body.rejectedQuantity, "rejectedQuantity"),
      quantityShipped: toNonNegIntOrNull(body.quantityShipped, "quantityShipped"),

      notes: body.notes?.toString().trim() || null,
    });

    return NextResponse.json({ success: true, id: inserted.id }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Failed to add QC entry." }, { status: 400 });
  }
}
