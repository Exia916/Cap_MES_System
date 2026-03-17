import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import {
  updateEmbroideryEntry,
  getEmbroideryEntryById,
} from "@/lib/repositories/embroideryRepo";

type Body = {
  id: string;
  entryTs: string;

  machineNumber?: string | number | null;
  salesOrder?: string | number | null;
  detailNumber?: string | number | null;
  embroideryLocation?: string | null;

  stitches?: string | number | null;
  pieces?: string | number | null;

  is3d?: boolean;
  isKnit?: boolean;
  detailComplete?: boolean;

  notes?: string | null;
};

function toNullableInt(value: unknown): number | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || !Number.isInteger(n)) return null;
  return n;
}

function toNonNegIntOrNull(value: unknown, fieldLabel: string): number | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) {
    throw new Error(`${fieldLabel} must be a non-negative integer.`);
  }
  return n;
}

function normalizeSalesOrderParts(value: unknown): {
  salesOrderBase: string | null;
  salesOrderDisplay: string | null;
  legacySalesOrder: number | null;
} {
  const raw = String(value ?? "").trim();

  if (!raw) {
    return {
      salesOrderBase: null,
      salesOrderDisplay: null,
      legacySalesOrder: null,
    };
  }

  const beforeDot = raw.split(".")[0]?.trim() ?? "";
  const digitsOnly = beforeDot.replace(/[^\d]/g, "");

  const legacySalesOrder =
    digitsOnly && Number.isFinite(Number(digitsOnly))
      ? Math.trunc(Number(digitsOnly))
      : null;

  return {
    salesOrderBase: digitsOnly || null,
    salesOrderDisplay: raw,
    legacySalesOrder,
  };
}

export async function PUT(req: NextRequest) {
  const auth = await getAuthFromRequest(req as any);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await req.json()) as Body;
    const id = body?.id?.trim() ?? "";

    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    const existing = await getEmbroideryEntryById(id);
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (
      auth.role !== "ADMIN" &&
      Number(auth.employeeNumber) !== Number(existing.employeeNumber)
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const entryTs = new Date(body.entryTs);
    if (Number.isNaN(entryTs.getTime())) {
      throw new Error("entryTs is invalid.");
    }

    const salesOrderParts = normalizeSalesOrderParts(body.salesOrder);

    await updateEmbroideryEntry({
      id,
      entryTs,
      name: String(existing.name),
      employeeNumber: Number(existing.employeeNumber),
      shift: String(existing.shift ?? ""),

      machineNumber: toNullableInt(body.machineNumber),
      detailNumber: toNullableInt(body.detailNumber),
      embroideryLocation:
        String(body.embroideryLocation ?? "").trim() || null,

      stitches: toNonNegIntOrNull(body.stitches, "stitches"),
      pieces: toNonNegIntOrNull(body.pieces, "pieces"),

      is3d: !!body.is3d,
      isKnit: !!body.isKnit,
      detailComplete: !!body.detailComplete,

      notes: String(body.notes ?? "").trim() || null,

      salesOrderBase: salesOrderParts.salesOrderBase,
      salesOrderDisplay: salesOrderParts.salesOrderDisplay,
      legacySalesOrder: salesOrderParts.legacySalesOrder,
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Failed to update entry." },
      { status: 400 }
    );
  }
}