import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import { updateEmbroideryEntry, getEmbroideryEntryById } from "@/lib/repositories/embroideryRepo";

type Body = {
  id: string;
  entryTs: string;

  machineNumber?: string | null;
  salesOrder?: string | null;
  detailNumber?: string | null;
  embroideryLocation?: string | null;

  stitches?: string | null;
  pieces?: string | null;

  is3d?: boolean;
  isKnit?: boolean;
  detailComplete?: boolean;

  notes?: string | null;
};

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

  try {
    const body = (await req.json()) as Body;
    const id = body?.id?.trim() ?? "";
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const existing = await getEmbroideryEntryById(id);
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (auth.role !== "ADMIN" && Number(auth.employeeNumber) !== Number(existing.employeeNumber)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const entryTs = new Date(body.entryTs);
    if (Number.isNaN(entryTs.getTime())) throw new Error("entryTs is invalid.");

    await updateEmbroideryEntry({
      id,
      entryTs,
      name: existing.name,
      employeeNumber: Number(existing.employeeNumber),
      shift: String(existing.shift ?? ""),

      machineNumber: toNullableInt(body.machineNumber),
      salesOrder: toNullableInt(body.salesOrder),
      detailNumber: toNullableInt(body.detailNumber),
      embroideryLocation: (body.embroideryLocation ?? "").toString().trim() || null,

      stitches: toNonNegIntOrNull(body.stitches, "stitches"),
      pieces: toNonNegIntOrNull(body.pieces, "pieces"),

      is3d: !!body.is3d,
      isKnit: !!body.isKnit,
      detailComplete: !!body.detailComplete,

      notes: body.notes?.toString().trim() || null,
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Failed to update entry." }, { status: 400 });
  }
}
