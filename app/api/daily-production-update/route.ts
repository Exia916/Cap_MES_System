import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  getEmbroideryEntryById,
  updateEmbroideryEntry,
} from "@/lib/repositories/embroideryRepo";

type PostBody = {
  entryTs?: string;
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

type Resp = { success: true } | { error: string };

function toNullableInt(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).trim());
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

function toNullableStr(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

function computeShiftCentral(entryTs: Date): "Day" | "Night" {
  const hourStr = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    hour: "2-digit",
    hour12: false,
  }).format(entryTs);

  const hour = Number(hourStr);
  return hour >= 6 && hour < 18 ? "Day" : "Night";
}

type UserLookupRow = {
  name: string;
  employeeNumber: number;
  shift: string | null;
};

export async function PUT(req: NextRequest) {
  const auth = getAuthFromRequest(req);
  if (!auth) return NextResponse.json<Resp>({ error: "Unauthorized" }, { status: 401 });

  const id = req.nextUrl.searchParams.get("id")?.trim() ?? "";
  if (!id) return NextResponse.json<Resp>({ error: "Missing id" }, { status: 400 });

  let body: PostBody;
  try {
    body = (await req.json()) as PostBody;
  } catch {
    return NextResponse.json<Resp>({ error: "Invalid JSON body" }, { status: 400 });
  }

  const entryTs = body.entryTs ? new Date(body.entryTs) : new Date();
  if (Number.isNaN(entryTs.getTime())) {
    return NextResponse.json<Resp>({ error: "Invalid entryTs" }, { status: 400 });
  }

  // Sales order must be exactly 7 digits if provided
  const salesOrderStr =
    body.salesOrder !== null && body.salesOrder !== undefined ? String(body.salesOrder).trim() : "";
  if (salesOrderStr && !/^\d{7}$/.test(salesOrderStr)) {
    return NextResponse.json<Resp>(
      { error: "Sales Order must be exactly 7 digits (e.g. 1234567)." },
      { status: 400 }
    );
  }

  try {
    const existing = await getEmbroideryEntryById(id);
    if (!existing) return NextResponse.json<Resp>({ error: "Not found" }, { status: 404 });

    // Non-admin can only update their own entries
    if (auth.role !== "ADMIN" && Number(auth.employeeNumber) !== Number(existing.employeeNumber)) {
      return NextResponse.json<Resp>({ error: "Forbidden" }, { status: 403 });
    }

    const emp = Number(auth.employeeNumber);
    if (!Number.isFinite(emp) || emp <= 0) {
      return NextResponse.json<Resp>(
        { error: "Your account is missing a valid employee number." },
        { status: 400 }
      );
    }

    // Canonical user values (FK-safe)
    const userRes = await db.query<UserLookupRow>(
      `
      SELECT
        COALESCE(display_name, name, username) AS "name",
        employee_number AS "employeeNumber",
        shift AS "shift"
      FROM users
      WHERE employee_number = $1
      LIMIT 1
      `,
      [emp]
    );

    if (userRes.rows.length === 0) {
      return NextResponse.json<Resp>(
        { error: `No user found in users table for employee_number=${emp}.` },
        { status: 400 }
      );
    }

    const user = userRes.rows[0];
    const computedShift = computeShiftCentral(entryTs);
    const shift = user.shift && user.shift.trim() ? user.shift.trim() : computedShift;

    await updateEmbroideryEntry({
      id,
      entryTs,
      name: user.name,
      employeeNumber: user.employeeNumber,
      shift,
      machineNumber: toNullableInt(body.machineNumber),
      salesOrder: salesOrderStr ? Number(salesOrderStr) : null,
      detailNumber: toNullableInt(body.detailNumber),
      embroideryLocation: toNullableStr(body.embroideryLocation),
      stitches: toNullableInt(body.stitches),
      pieces: toNullableInt(body.pieces),
      is3d: Boolean(body.is3d),
      isKnit: Boolean(body.isKnit),
      detailComplete: Boolean(body.detailComplete),
      notes: toNullableStr(body.notes),
    });

    return NextResponse.json<Resp>({ success: true }, { status: 200 });
  } catch (err: any) {
    console.error("daily-production-update PUT error:", err);
    return NextResponse.json<Resp>({ error: "Server error" }, { status: 500 });
  }
}
