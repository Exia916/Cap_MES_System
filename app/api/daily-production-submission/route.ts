import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import {
  getEmbroiderySubmissionWithLines,
  replaceEmbroiderySubmission,
} from "@/lib/repositories/embroideryRepo";

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

  const data = await getEmbroiderySubmissionWithLines(id);
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (auth.role !== "ADMIN" && Number(auth.employeeNumber) !== Number(data.submission.employeeNumber)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json(data, { status: 200 });
}

type PutBody = {
  entryTs: string;
  machineNumber?: string | null;
  notes?: string | null; // header notes
  lines: Array<{
    detailNumber: string;
    embroideryLocation: string;
    stitches: string;
    pieces: string;
    is3d: boolean;
    isKnit: boolean;
    detailComplete: boolean;
    notes?: string | null; // per-line notes
  }>;
};

export async function PUT(req: NextRequest) {
  const auth = await getAuthFromRequest(req as any);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = req.nextUrl.searchParams.get("id")?.trim() ?? "";
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const existing = await getEmbroiderySubmissionWithLines(id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (auth.role !== "ADMIN" && Number(auth.employeeNumber) !== Number(existing.submission.employeeNumber)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = (await req.json()) as PutBody;

    if (!body?.entryTs) throw new Error("entryTs is required.");
    if (!Array.isArray(body.lines) || body.lines.length === 0) {
      throw new Error("At least one line is required.");
    }

    const entryTs = new Date(body.entryTs);
    if (Number.isNaN(entryTs.getTime())) throw new Error("entryTs is invalid.");

    const machineNumber = toNullableInt(body.machineNumber);
    const headerNotes = body.notes?.toString().trim() || null;

    const lines = body.lines.map((l, idx) => {
      const detailNumber = toNullableInt(l.detailNumber);
      const embroideryLocation = (l.embroideryLocation ?? "").toString().trim();

      if (detailNumber === null) throw new Error(`Line ${idx + 1}: detailNumber is required (number).`);
      if (!embroideryLocation) throw new Error(`Line ${idx + 1}: embroideryLocation is required.`);

      return {
        detailNumber,
        embroideryLocation,
        stitches: toNonNegIntOrNull(l.stitches, `Line ${idx + 1}: stitches`),
        pieces: toNonNegIntOrNull(l.pieces, `Line ${idx + 1}: pieces`),
        is3d: !!l.is3d,
        isKnit: !!l.isKnit,
        detailComplete: !!l.detailComplete,
        notes: l.notes?.toString().trim() || null,
      };
    });

    const result = await replaceEmbroiderySubmission({
      submissionId: id,
      entryTs,
      machineNumber,
      notes: headerNotes,
      lines,
    });

    return NextResponse.json({ success: true, count: result.count }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Failed to update submission." }, { status: 400 });
  }
}
