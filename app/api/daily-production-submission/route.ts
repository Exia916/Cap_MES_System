import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import { getEmbroiderySubmissionWithLines, replaceEmbroiderySubmission } from "@/lib/repositories/embroideryRepo";
import { normalizeSalesOrder, toLegacySalesOrderNumber } from "@/lib/utils/salesOrder";

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
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) {
    throw new Error(`${label} must be a non-negative integer.`);
  }
  return n;
}

export async function GET(req: NextRequest) {
  const auth = await getAuthFromRequest(req as any);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = req.nextUrl.searchParams.get("id")?.trim() ?? "";
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const result = await getEmbroiderySubmissionWithLines(id);
  if (!result) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { submission, lines } = result;

  if (auth.role !== "ADMIN" && Number(auth.employeeNumber) !== Number(submission.employeeNumber)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({ submission, lines }, { status: 200 });
}

export async function PUT(req: NextRequest) {
  const auth = await getAuthFromRequest(req as any);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = req.nextUrl.searchParams.get("id")?.trim() ?? "";
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const result = await getEmbroiderySubmissionWithLines(id);
  if (!result) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { submission } = result;

  if (auth.role !== "ADMIN" && Number(auth.employeeNumber) !== Number(submission.employeeNumber)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();

    const entryTs = new Date(body.entryTs ?? new Date().toISOString());
    if (Number.isNaN(entryTs.getTime())) throw new Error("entryTs is invalid.");

    const normalizedSO = normalizeSalesOrder(body.salesOrder);
    if (!normalizedSO.isValid) {
      throw new Error(normalizedSO.error ?? "Invalid Sales Order.");
    }

    const legacySalesOrder = toLegacySalesOrderNumber(normalizedSO.salesOrderBase);
    const machineNumber = toNullableInt(body.machineNumber);
    const headerNotes = body.notes?.toString().trim() || null;
    const annex = !!body.annex;

    const lines = Array.isArray(body.lines) ? body.lines : [];
    if (lines.length === 0) throw new Error("At least one line is required.");

    const update = await replaceEmbroiderySubmission({
      submissionId: id,
      entryTs,
      machineNumber,
      salesOrderBase: normalizedSO.salesOrderBase,
      salesOrderDisplay: normalizedSO.salesOrderDisplay,
      legacySalesOrder,
      annex,
      notes: headerNotes,
      lines: lines.map((l: any, i: number) => {
        const detailNumber = toNullableInt(l.detailNumber);
        if (detailNumber === null) throw new Error(`Line ${i + 1}: detailNumber is required.`);

        const embroideryLocation = String(l.embroideryLocation ?? "").trim();
        if (!embroideryLocation) throw new Error(`Line ${i + 1}: embroideryLocation is required.`);

        return {
          detailNumber,
          embroideryLocation,
          stitches: toNonNegIntOrNull(l.stitches, `Line ${i + 1}: stitches`),
          pieces: toNonNegIntOrNull(l.pieces, `Line ${i + 1}: pieces`),
          jobberSamplesRan: annex
            ? toNonNegIntOrNull(l.jobberSamplesRan, `Line ${i + 1}: jobberSamplesRan`)
            : null,
          is3d: !!l.is3d,
          isKnit: !!l.isKnit,
          detailComplete: !!l.detailComplete,
          notes: l.notes?.toString().trim() || null,
        };
      }),
    });

    return NextResponse.json({ success: true, count: update.count }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Failed to update submission." },
      { status: 400 }
    );
  }
}