import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import { getQCSubmissionWithLines, replaceQCSubmission } from "@/lib/repositories/qcRepo";

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

export async function PUT(req: NextRequest) {
  const auth = await getAuthFromRequest(req as any);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();

    const submissionId = (body.id ?? "").toString().trim();
    if (!submissionId) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const { submission } = await getQCSubmissionWithLines(submissionId);
    if (!submission) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (auth.role !== "ADMIN" && Number(auth.employeeNumber) !== Number(submission.employeeNumber)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const entryTs = new Date(body.entryTs ?? new Date().toISOString());
    if (Number.isNaN(entryTs.getTime())) throw new Error("entryTs is invalid.");

    const salesOrder = toNullableInt(body.salesOrder);
    const notes = body.notes?.toString().trim() || null;

    const lines = Array.isArray(body.lines) ? body.lines : [];
    if (lines.length === 0) throw new Error("At least one line is required.");

    const result = await replaceQCSubmission({
      submissionId,
      entryTs,
      name: submission.name,
      employeeNumber: submission.employeeNumber,
      salesOrder,
      notes,
      lines: lines.map((l: any, i: number) => ({
        detailNumber: toNullableInt(l.detailNumber),
        flatOr3d: normalizeFlatOr3d(l.flatOr3d),
        orderQuantity: toNonNegIntOrNull(l.orderQuantity, `Line ${i + 1}: orderQuantity`),
        inspectedQuantity: toNonNegIntOrNull(l.inspectedQuantity, `Line ${i + 1}: inspectedQuantity`),
        rejectedQuantity: toNonNegIntOrNull(l.rejectedQuantity, `Line ${i + 1}: rejectedQuantity`),
        quantityShipped: toNonNegIntOrNull(l.quantityShipped, `Line ${i + 1}: quantityShipped`),
        notes: l.notes?.toString().trim() || null,
      })),
    });

    return NextResponse.json({ success: true, count: result.count }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Failed to update QC submission." }, { status: 400 });
  }
}
