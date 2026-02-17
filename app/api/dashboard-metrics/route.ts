import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import { db } from "@/lib/db";

type MetricsSuccess = {
  date: string;
  totalStitches: number;
  totalPieces: number;
  qcFlatInspected: number;
  qc3DInspected: number;
  qcTotalInspected: number;
  emblemSewPieces: number;
  emblemStickerPieces: number;
  emblemHeatSealPieces: number;
  emblemTotalPieces: number;
  laserTotalPieces: number;
};

type MetricsError = {
  error: string;
};

type MetricsResponse = MetricsSuccess | MetricsError;

function isValidYmd(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function toNumber(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export async function GET(req: NextRequest) {
  const auth = getAuthFromRequest(req);
  if (!auth) {
    return NextResponse.json<MetricsResponse>({ error: "Unauthorized" }, { status: 401 });
  }

  const date = req.nextUrl.searchParams.get("date")?.trim() ?? "";
  if (!date) {
    return NextResponse.json<MetricsResponse>(
      { error: "Missing date parameter" },
      { status: 400 }
    );
  }

  if (!isValidYmd(date)) {
    return NextResponse.json<MetricsResponse>(
      { error: "Invalid date format. Use YYYY-MM-DD" },
      { status: 400 }
    );
  }

  try {
    const [embroideryRes, qcRes, emblemRes, laserRes] = await Promise.all([
      db.query<{
        shift_stitches: string | number | null;
        shift_pieces: string | number | null;
      }>(
        `
        SELECT shift_stitches, shift_pieces
        FROM public.embroidery_shift_totals
        WHERE shift_date = $1::date
        LIMIT 1
        `,
        [date]
      ),
      db.query<{
        flat_totals: string | number | null;
        three_d_totals: string | number | null;
        total_quantity_inspected_by_date: string | number | null;
      }>(
        `
        SELECT flat_totals, three_d_totals, total_quantity_inspected_by_date
        FROM public.qc_daily_totals
        WHERE entry_date = $1::date
        LIMIT 1
        `,
        [date]
      ),
      db.query<{
        sew: string | number | null;
        sticker: string | number | null;
        heat_seal: string | number | null;
        total_pieces: string | number | null;
      }>(
        `
        SELECT sew, sticker, heat_seal, total_pieces
        FROM public.emblem_daily_totals
        WHERE entry_date = $1::date
        LIMIT 1
        `,
        [date]
      ),
      db.query<{
        total_pieces_per_day: string | number | null;
      }>(
        `
        SELECT total_pieces_per_day
        FROM public.laser_daily_totals
        WHERE entry_date = $1::date
        LIMIT 1
        `,
        [date]
      ),
    ]);

    const embroidery = embroideryRes.rows[0];
    const qc = qcRes.rows[0];
    const emblem = emblemRes.rows[0];
    const laser = laserRes.rows[0];

    return NextResponse.json<MetricsResponse>(
      {
        date,
        totalStitches: toNumber(embroidery?.shift_stitches),
        totalPieces: toNumber(embroidery?.shift_pieces),
        qcFlatInspected: toNumber(qc?.flat_totals),
        qc3DInspected: toNumber(qc?.three_d_totals),
        qcTotalInspected: toNumber(qc?.total_quantity_inspected_by_date),
        emblemSewPieces: toNumber(emblem?.sew),
        emblemStickerPieces: toNumber(emblem?.sticker),
        emblemHeatSealPieces: toNumber(emblem?.heat_seal),
        emblemTotalPieces: toNumber(emblem?.total_pieces),
        laserTotalPieces: toNumber(laser?.total_pieces_per_day),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error computing dashboard metrics:", error);
    return NextResponse.json<MetricsResponse>(
      { error: "Failed to compute dashboard metrics" },
      { status: 500 }
    );
  }
}
