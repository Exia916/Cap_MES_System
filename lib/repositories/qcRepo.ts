import { db } from "@/lib/db";

export type QCDailyEntry = {
  id: string;
  entryTs: string;
  entryDate: string; // generated in DB

  name: string;
  employeeNumber: number;

  salesOrder: number | null;
  detailNumber: number | null;
  flatOr3d: string | null;

  orderQuantity: number | null;
  inspectedQuantity: number | null;
  rejectedQuantity: number | null;
  quantityShipped: number | null;

  notes: string | null;
  createdAt: string;
};

export type AddQCDailyEntryInput = {
  entryTs: Date;

  name: string;
  employeeNumber: number;

  salesOrder: number | null;
  detailNumber: number | null;
  flatOr3d: string | null;

  orderQuantity: number | null;
  inspectedQuantity: number | null;
  rejectedQuantity: number | null;
  quantityShipped: number | null;

  notes: string | null;
};

export type UpdateQCDailyEntryInput = AddQCDailyEntryInput & { id: string };

export async function addQCDailyEntry(input: AddQCDailyEntryInput): Promise<{ id: string }> {
  const { rows } = await db.query<{ id: string }>(
    `
    INSERT INTO public.qc_daily_entries (
      entry_ts,
      name,
      employee_number,
      sales_order,
      detail_number,
      flat_or_3d,
      order_quantity,
      inspected_quantity,
      rejected_quantity,
      quantity_shipped,
      notes
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
    RETURNING id
    `,
    [
      input.entryTs,
      input.name,
      input.employeeNumber,
      input.salesOrder,
      input.detailNumber,
      input.flatOr3d,
      input.orderQuantity,
      input.inspectedQuantity,
      input.rejectedQuantity,
      input.quantityShipped,
      input.notes,
    ]
  );

  return rows[0];
}

export async function getQCDailyEntryById(id: string): Promise<QCDailyEntry | null> {
  const { rows } = await db.query<QCDailyEntry>(
    `
    SELECT
      id,
      entry_ts AS "entryTs",
      entry_date AS "entryDate",
      name,
      employee_number AS "employeeNumber",
      sales_order AS "salesOrder",
      detail_number AS "detailNumber",
      flat_or_3d AS "flatOr3d",
      order_quantity AS "orderQuantity",
      inspected_quantity AS "inspectedQuantity",
      rejected_quantity AS "rejectedQuantity",
      quantity_shipped AS "quantityShipped",
      notes,
      created_at AS "createdAt"
    FROM public.qc_daily_entries
    WHERE id = $1
    LIMIT 1
    `,
    [id]
  );

  return rows[0] ?? null;
}

export async function listQCDailyEntriesByEntryDate(entryDate: string): Promise<QCDailyEntry[]> {
  const { rows } = await db.query<QCDailyEntry>(
    `
    SELECT
      id,
      entry_ts AS "entryTs",
      entry_date AS "entryDate",
      name,
      employee_number AS "employeeNumber",
      sales_order AS "salesOrder",
      detail_number AS "detailNumber",
      flat_or_3d AS "flatOr3d",
      order_quantity AS "orderQuantity",
      inspected_quantity AS "inspectedQuantity",
      rejected_quantity AS "rejectedQuantity",
      quantity_shipped AS "quantityShipped",
      notes,
      created_at AS "createdAt"
    FROM public.qc_daily_entries
    WHERE entry_date = $1::date
    ORDER BY entry_ts DESC
    `,
    [entryDate]
  );

  return rows;
}

export async function listQCDailyEntriesByUserAndEntryDate(
  employeeNumber: number,
  entryDate: string
): Promise<QCDailyEntry[]> {
  const { rows } = await db.query<QCDailyEntry>(
    `
    SELECT
      id,
      entry_ts AS "entryTs",
      entry_date AS "entryDate",
      name,
      employee_number AS "employeeNumber",
      sales_order AS "salesOrder",
      detail_number AS "detailNumber",
      flat_or_3d AS "flatOr3d",
      order_quantity AS "orderQuantity",
      inspected_quantity AS "inspectedQuantity",
      rejected_quantity AS "rejectedQuantity",
      quantity_shipped AS "quantityShipped",
      notes,
      created_at AS "createdAt"
    FROM public.qc_daily_entries
    WHERE employee_number = $1
      AND entry_date = $2::date
    ORDER BY entry_ts DESC
    `,
    [employeeNumber, entryDate]
  );

  return rows;
}

export async function updateQCDailyEntry(input: UpdateQCDailyEntryInput): Promise<void> {
  await db.query(
    `
    UPDATE public.qc_daily_entries
    SET
      entry_ts = $2,
      name = $3,
      employee_number = $4,
      sales_order = $5,
      detail_number = $6,
      flat_or_3d = $7,
      order_quantity = $8,
      inspected_quantity = $9,
      rejected_quantity = $10,
      quantity_shipped = $11,
      notes = $12
    WHERE id = $1
    `,
    [
      input.id,
      input.entryTs,
      input.name,
      input.employeeNumber,
      input.salesOrder,
      input.detailNumber,
      input.flatOr3d,
      input.orderQuantity,
      input.inspectedQuantity,
      input.rejectedQuantity,
      input.quantityShipped,
      input.notes,
    ]
  );
}
