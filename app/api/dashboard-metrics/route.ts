import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyJwt } from "@/lib/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";

function isYmd(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function todayYmdChicago(): string {
  const now = new Date();
  const chicago = new Date(
    now.toLocaleString("en-US", { timeZone: "America/Chicago" })
  );
  const y = chicago.getFullYear();
  const m = String(chicago.getMonth() + 1).padStart(2, "0");
  const d = String(chicago.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export async function GET(req: Request) {
  try {
    // ---------------------------
    // Auth
    // ---------------------------
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const payload: any = verifyJwt(token);
    if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const employeeNumber = Number(payload.employeeNumber);
    if (!employeeNumber) {
      return NextResponse.json(
        { error: "Missing employeeNumber in token payload" },
        { status: 400 }
      );
    }

    const url = new URL(req.url);
    const dateParam = (url.searchParams.get("date") || "").trim();
    const date = isYmd(dateParam) ? dateParam : todayYmdChicago();

    // ---------------------------
// 1) Embroidery
// Uses shift_date (NOT entry_ts)
// ---------------------------
const emb = await db.query<{
  total_stitches: string | number | null;
  total_pieces: string | number | null;
}>(
  `
  SELECT
    COALESCE(SUM(stitches * pieces), 0) AS total_stitches,
    COALESCE(SUM(pieces), 0) AS total_pieces
  FROM embroidery_daily_entries
  WHERE employee_number = $1
    AND shift_date = $2::date
  `,
  [employeeNumber, date]
);

    const totalStitches = Number(emb.rows[0]?.total_stitches ?? 0) || 0;
    const totalPieces = Number(emb.rows[0]?.total_pieces ?? 0) || 0;

    // ---------------------------
    // 2) QC
    // ---------------------------
    const qc = await db.query<{
      flat_inspected: string | number | null;
      d3_inspected: string | number | null;
      total_inspected: string | number | null;
    }>(
      `
      SELECT
        COALESCE(SUM(CASE WHEN LOWER(flat_or_3d) = '3d' THEN inspected_quantity ELSE 0 END), 0) AS d3_inspected,
        COALESCE(SUM(CASE WHEN LOWER(flat_or_3d) = '3d' THEN 0 ELSE inspected_quantity END), 0) AS flat_inspected,
        COALESCE(SUM(inspected_quantity), 0) AS total_inspected
      FROM qc_daily_entries
      WHERE employee_number = $1
        AND entry_date = $2::date
      `,
      [employeeNumber, date]
    );

    const qc3DInspected = Number(qc.rows[0]?.d3_inspected ?? 0) || 0;
    const qcFlatInspected = Number(qc.rows[0]?.flat_inspected ?? 0) || 0;
    const qcTotalInspected = Number(qc.rows[0]?.total_inspected ?? 0) || 0;

    // ---------------------------
    // 3) Emblem (submission header + lines)
    // ---------------------------
    const emblem = await db.query<{
      sew_pieces: string | number | null;
      sticker_pieces: string | number | null;
      heat_seal_pieces: string | number | null;
      total_pieces: string | number | null;
    }>(
      `
      SELECT
        COALESCE(SUM(CASE WHEN LOWER(l.emblem_type) = 'sew' THEN l.pieces ELSE 0 END), 0) AS sew_pieces,
        COALESCE(SUM(CASE WHEN LOWER(l.emblem_type) = 'sticker' THEN l.pieces ELSE 0 END), 0) AS sticker_pieces,
        COALESCE(SUM(CASE WHEN LOWER(REPLACE(l.emblem_type, '_', ' ')) IN ('heat seal','heatseal') THEN l.pieces ELSE 0 END), 0) AS heat_seal_pieces,
        COALESCE(SUM(l.pieces), 0) AS total_pieces
      FROM emblem_daily_submissions s
      JOIN emblem_daily_submission_lines l ON l.submission_id = s.id
      WHERE s.employee_number = $1
        AND s.entry_date = $2::date
      `,
      [employeeNumber, date]
    );

    const emblemSewPieces = Number(emblem.rows[0]?.sew_pieces ?? 0) || 0;
    const emblemStickerPieces = Number(emblem.rows[0]?.sticker_pieces ?? 0) || 0;
    const emblemHeatSealPieces = Number(emblem.rows[0]?.heat_seal_pieces ?? 0) || 0;
    const emblemTotalPieces = Number(emblem.rows[0]?.total_pieces ?? 0) || 0;

    // ---------------------------
    // 4) Laser
    // ---------------------------
    const laser = await db.query<{ total_pieces: string | number | null }>(
      `
      SELECT COALESCE(SUM(pieces_cut), 0) AS total_pieces
      FROM laser_entries
      WHERE employee_number = $1
        AND entry_date = $2::date
      `,
      [employeeNumber, date]
    );

    const laserTotalPieces = Number(laser.rows[0]?.total_pieces ?? 0) || 0;

    return NextResponse.json({
      date,
      totalStitches,
      totalPieces,
      qcFlatInspected,
      qc3DInspected,
      qcTotalInspected,
      emblemSewPieces,
      emblemStickerPieces,
      emblemHeatSealPieces,
      emblemTotalPieces,
      laserTotalPieces,
    });
  } catch (err) {
    console.error("dashboard-metrics error:", err);
    const message =
  err instanceof Error ? err.message : "Failed to compute dashboard metrics";

return NextResponse.json(
  { error: process.env.NODE_ENV === "production" ? "Failed to compute dashboard metrics" : message },
  { status: 500 }
);

  }
}
