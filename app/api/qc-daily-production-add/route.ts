import { NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import { createQCSubmission, addQCLinesBulk } from "@/lib/repositories/qcRepo";

type LineBody = {
  detailNumber: string;
  flatOr3d: string;
  orderQuantity: string;
  inspectedQuantity: string;
  rejectedQuantity: string;
  quantityShipped: string;
  notes?: string | null;
};

type Body = {
  entryTs: string;
  salesOrder?: string | null;
  notes?: string | null; // header notes
  lines: LineBody[];
};

function toNullableInt(value: unknown): number | null {
  const raw = (value ?? "").toString().trim();
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || !Number.isInteger(n)) return null;
  return n;
}

function toNonNegIntOrNull(value: unknown, label: string): number | null {
  const raw = (value ?? "").toString().trim();
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) throw new Error(`${label} must be a non-negative integer.`);
  return n;
}

function normalizeFlatOr3d(v: unknown): "FLAT" | "3D" | null {
  const s = (v ?? "").toString().trim().toUpperCase();
  if (!s) return null;
  if (s === "FLAT") return "FLAT";
  if (s === "3D") return "3D";
  throw new Error("Flat Or 3D must be FLAT or 3D.");
}

export async function POST(req: Request) {
  try {
    const auth = await getAuthFromRequest(req as any);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const name = auth.displayName ?? auth.username ?? "";
    const employeeNumber = Number(auth.employeeNumber);
    if (!name) throw new Error("Authenticated user name not found.");
    if (!Number.isFinite(employeeNumber)) throw new Error("Authenticated employeeNumber not found.");

    const body = (await req.json()) as Body;

    if (!body?.entryTs) throw new Error("entryTs is required.");
    if (!Array.isArray(body?.lines) || body.lines.length === 0) throw new Error("At least one line is required.");

    const entryTs = new Date(body.entryTs);
    if (Number.isNaN(entryTs.getTime())) throw new Error("entryTs is invalid.");

    const salesOrder = toNullableInt(body.salesOrder);
    const headerNotes = body.notes?.toString().trim() || null;

    const sub = await createQCSubmission({
      entryTs,
      name,
      employeeNumber,
      salesOrder,
      notes: headerNotes,
    });

    const inserted = await addQCLinesBulk({
      submissionId: sub.id,
      entryTs,
      name,
      employeeNumber,
      salesOrder,
      lines: body.lines.map((l, i) => {
        const detailNumber = toNullableInt(l.detailNumber);
        if (detailNumber === null) throw new Error(`Line ${i + 1}: detailNumber is required (number).`);

        return {
          detailNumber,
          flatOr3d: normalizeFlatOr3d(l.flatOr3d),
          orderQuantity: toNonNegIntOrNull(l.orderQuantity, `Line ${i + 1}: orderQuantity`),
          inspectedQuantity: toNonNegIntOrNull(l.inspectedQuantity, `Line ${i + 1}: inspectedQuantity`),
          rejectedQuantity: toNonNegIntOrNull(l.rejectedQuantity, `Line ${i + 1}: rejectedQuantity`),
          quantityShipped: toNonNegIntOrNull(l.quantityShipped, `Line ${i + 1}: quantityShipped`),
          notes: l.notes?.toString().trim() || null,
        };
      }),
    });

    return NextResponse.json({ success: true, submissionId: sub.id, count: inserted.ids.length, ids: inserted.ids });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Failed to add QC submission." }, { status: 400 });
  }
}
