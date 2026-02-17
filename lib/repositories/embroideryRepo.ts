import { db } from "@/lib/db";

export type EmbroideryEntry = {
  id: string;
  entryTs: string;
  name: string;

  employeeNumber?: number;
  shift?: string;

  machineNumber: number | null;
  salesOrder: number | null;
  detailNumber: number | null;
  embroideryLocation: string | null;

  stitches: number | null;
  pieces: number | null;

  is3d: boolean;
  isKnit: boolean;
  detailComplete: boolean;

  notes: string | null;
};

export type AddEmbroideryEntryInput = {
  entryTs: Date;
  name: string;
  employeeNumber: number;
  shift: string;

  machineNumber: number | null;
  salesOrder: number | null;
  detailNumber: number | null;
  embroideryLocation: string | null;

  stitches: number | null;
  pieces: number | null;

  is3d: boolean;
  isKnit: boolean;
  detailComplete: boolean;

  notes: string | null;
};

export type UpdateEmbroideryEntryInput = {
  id: string;

  entryTs: Date;
  name: string;
  employeeNumber: number;
  shift: string;

  machineNumber: number | null;
  salesOrder: number | null;
  detailNumber: number | null;
  embroideryLocation: string | null;

  stitches: number | null;
  pieces: number | null;

  is3d: boolean;
  isKnit: boolean;
  detailComplete: boolean;

  notes: string | null;
};

export async function addEmbroideryEntry(
  input: AddEmbroideryEntryInput
): Promise<{ id: string }> {
  // shift_date is GENERATED in Postgres — do NOT insert it.
  const { rows } = await db.query<{ id: string }>(
    `
    INSERT INTO public.embroidery_daily_entries (
      entry_ts,
      name,
      employee_number,
      shift,
      machine_number,
      sales_order,
      detail_number,
      embroidery_location,
      stitches,
      pieces,
      is_3d,
      is_knit,
      detail_complete,
      notes
    )
    VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14
    )
    RETURNING id
    `,
    [
      input.entryTs,
      input.name,
      input.employeeNumber,
      input.shift,
      input.machineNumber,
      input.salesOrder,
      input.detailNumber,
      input.embroideryLocation,
      input.stitches,
      input.pieces,
      input.is3d,
      input.isKnit,
      input.detailComplete,
      input.notes,
    ]
  );

  return rows[0];
}

export async function listEmbroideryEntriesByShiftDate(
  shiftDate: string
): Promise<EmbroideryEntry[]> {
  const { rows } = await db.query<EmbroideryEntry>(
    `
    SELECT
      id,
      entry_ts AS "entryTs",
      name,
      employee_number AS "employeeNumber",
      shift,
      machine_number AS "machineNumber",
      sales_order AS "salesOrder",
      detail_number AS "detailNumber",
      embroidery_location AS "embroideryLocation",
      stitches,
      pieces,
      is_3d AS "is3d",
      is_knit AS "isKnit",
      detail_complete AS "detailComplete",
      notes
    FROM public.embroidery_daily_entries
    WHERE shift_date = $1
    ORDER BY entry_ts DESC
    `,
    [shiftDate]
  );

  return rows;
}

export async function listEmbroideryEntriesByUserAndShiftDate(
  employeeNumber: number,
  shiftDate: string
): Promise<EmbroideryEntry[]> {
  const { rows } = await db.query<EmbroideryEntry>(
    `
    SELECT
      id,
      entry_ts AS "entryTs",
      name,
      employee_number AS "employeeNumber",
      shift,
      machine_number AS "machineNumber",
      sales_order AS "salesOrder",
      detail_number AS "detailNumber",
      embroidery_location AS "embroideryLocation",
      stitches,
      pieces,
      is_3d AS "is3d",
      is_knit AS "isKnit",
      detail_complete AS "detailComplete",
      notes
    FROM public.embroidery_daily_entries
    WHERE employee_number = $1
      AND shift_date = $2
    ORDER BY entry_ts DESC
    `,
    [employeeNumber, shiftDate]
  );

  return rows;
}

export async function getEmbroideryEntryById(
  id: string
): Promise<EmbroideryEntry | null> {
  const { rows } = await db.query<EmbroideryEntry>(
    `
    SELECT
      id,
      entry_ts AS "entryTs",
      name,
      employee_number AS "employeeNumber",
      shift,
      machine_number AS "machineNumber",
      sales_order AS "salesOrder",
      detail_number AS "detailNumber",
      embroidery_location AS "embroideryLocation",
      stitches,
      pieces,
      is_3d AS "is3d",
      is_knit AS "isKnit",
      detail_complete AS "detailComplete",
      notes
    FROM public.embroidery_daily_entries
    WHERE id = $1
    LIMIT 1
    `,
    [id]
  );

  return rows[0] ?? null;
}

export async function updateEmbroideryEntry(
  input: UpdateEmbroideryEntryInput
): Promise<void> {
  await db.query(
    `
    UPDATE public.embroidery_daily_entries
    SET
      entry_ts = $2,
      name = $3,
      employee_number = $4,
      shift = $5,
      machine_number = $6,
      sales_order = $7,
      detail_number = $8,
      embroidery_location = $9,
      stitches = $10,
      pieces = $11,
      is_3d = $12,
      is_knit = $13,
      detail_complete = $14,
      notes = $15
    WHERE id = $1
    `,
    [
      input.id,
      input.entryTs,
      input.name,
      input.employeeNumber,
      input.shift,
      input.machineNumber,
      input.salesOrder,
      input.detailNumber,
      input.embroideryLocation,
      input.stitches,
      input.pieces,
      input.is3d,
      input.isKnit,
      input.detailComplete,
      input.notes,
    ]
  );
}

