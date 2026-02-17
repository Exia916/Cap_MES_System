import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import { getQCDailyEntryById, updateQCDailyEntry } from "@/lib/repositories/qcRepo";

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

export async function PUT(req: NextRequest) {
  const auth = await getAuthFromRequest(req as any);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const id = (body.id ?? "").toString().trim();
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const existing = await getQCDailyEntryById(id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (auth.role !== "ADMIN" && Number(auth.employeeNumber) !== Number(existing.employeeNumber)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const entryTs = new Date(body.entryTs ?? new Date().toISOString());
    if (Number.isNaN(entryTs.getTime())) throw new Error("entryTs is invalid.");

    await updateQCDailyEntry({
      id,
      entryTs,

      name: existing.name,
      employeeNumber: Number(existing.employeeNumber),
      shift: String(existing.shift ?? ""),

      salesOrderNumber: toNullableInt(body.salesOrderNumber),
      detailNumber: toNullableInt(body.detailNumber),
      flatOr3d: (body.flatOr3d ?? "").toString().trim() || null,

      orderQuantity: toNonNegIntOrNull(body.orderQuantity, "orderQuantity"),
      inspectedQuantity: toNonNegIntOrNull(body.inspectedQuantity, "inspectedQuantity"),
      rejectedQuantity: toNonNegIntOrNull(body.rejectedQuantity, "rejectedQuantity"),
      quantityShipped: toNonNegIntOrNull(body.quantityShipped, "quantityShipped"),

      notes: body.notes?.toString().trim() || null,
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Failed to update QC entry." }, { status: 400 });
  }
}
