import { NextResponse } from "next/server";
import { addEmbroideryEntry } from "@/lib/repositories/embroideryRepo";
import { getAuthFromRequest } from "@/lib/auth";

type LineBody = {
  detailNumber: string;
  embroideryLocation: string;
  stitches: string;
  pieces: string;
  is3d: boolean;
  isKnit: boolean;
  detailComplete: boolean;
  notes?: string | null;
};

type Body = {
  entryTs: string;
  salesOrder?: string | null;
  machineNumber?: string | null;
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

function toNonNegIntOrNull(value: unknown, fieldLabel: string): number | null {
  const raw = (value ?? "").toString().trim();
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) {
    throw new Error(`${fieldLabel} must be a non-negative integer.`);
  }
  return n;
}

function combineNotes(headerNotes: string | null, lineNotes: string | null) {
  const h = headerNotes?.trim() || "";
  const l = lineNotes?.trim() || "";
  if (h && l) return `${h} | ${l}`;
  if (h) return h;
  if (l) return l;
  return null;
}

export async function POST(req: Request) {
  try {
    const auth = await getAuthFromRequest(req as any);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const name = auth.displayName ?? auth.username ?? "";
    const employeeNumber = Number(auth.employeeNumber);
    const shift = auth.shift ?? "";

    if (!name) throw new Error("Authenticated user name not found.");
    if (!Number.isFinite(employeeNumber)) throw new Error("Authenticated employeeNumber not found.");
    if (!shift) throw new Error("Authenticated shift not found.");

    const body = (await req.json()) as Body;

    if (!body?.entryTs) throw new Error("entryTs is required.");
    if (!Array.isArray(body?.lines) || body.lines.length === 0) {
      throw new Error("At least one line is required.");
    }

    const entryTs = new Date(body.entryTs);
    if (Number.isNaN(entryTs.getTime())) throw new Error("entryTs is invalid.");

    const machineNumber = toNullableInt(body.machineNumber);
    const salesOrder = toNullableInt(body.salesOrder);
    const headerNotes = body.notes?.toString().trim() || null;

    const ids: string[] = [];

    for (let i = 0; i < body.lines.length; i++) {
      const line = body.lines[i];

      const detailNumber = toNullableInt(line.detailNumber);
      const embroideryLocation = (line.embroideryLocation ?? "").toString().trim();

      if (detailNumber === null) throw new Error(`Line ${i + 1}: detailNumber is required (number).`);
      if (!embroideryLocation) throw new Error(`Line ${i + 1}: embroideryLocation is required.`);

      const stitches = toNonNegIntOrNull(line.stitches, `Line ${i + 1}: stitches`);
      const pieces = toNonNegIntOrNull(line.pieces, `Line ${i + 1}: pieces`);

      const notes = combineNotes(headerNotes, line.notes?.toString() || null);

      const inserted = await addEmbroideryEntry({
        entryTs,
        name,
        employeeNumber,
        shift,

        machineNumber,
        salesOrder,
        detailNumber,
        embroideryLocation,

        stitches,
        pieces,

        is3d: !!line.is3d,
        isKnit: !!line.isKnit,
        detailComplete: !!line.detailComplete,

        notes,
      });

      ids.push(inserted.id);
    }

    return NextResponse.json({ success: true, count: ids.length, ids });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Failed to add daily production entry." },
      { status: 400 }
    );
  }
}
