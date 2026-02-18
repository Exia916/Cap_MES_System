import { db } from "@/lib/db";

export type QCSubmission = {
  id: string;
  entryTs: string;
  entryDate: string;
  name: string;
  employeeNumber: number;
  salesOrder: number | null;
  notes: string | null;
  createdAt: string;
};

export type QCLine = {
  id: string;
  submissionId: string;
  entryTs: string;
  entryDate: string;

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

export async function createQCSubmission(input: {
  entryTs: Date;
  name: string;
  employeeNumber: number;
  salesOrder: number | null;
  notes: string | null;
}): Promise<{ id: string }> {
  // entry_date is GENERATED in Postgres — do NOT insert it.
  const { rows } = await db.query<{ id: string }>(
    `
    INSERT INTO public.qc_daily_submissions (
      entry_ts,
      name,
      employee_number,
      sales_order,
      notes
    )
    VALUES ($1,$2,$3,$4,$5)
    RETURNING id
    `,
    [input.entryTs, input.name, input.employeeNumber, input.salesOrder, input.notes]
  );

  return rows[0];
}

export async function addQCLinesBulk(input: {
  submissionId: string;
  entryTs: Date;
  name: string;
  employeeNumber: number;
  salesOrder: number | null; // applied to each line
  lines: Array<{
    detailNumber: number | null;
    flatOr3d: string | null;
    orderQuantity: number | null;
    inspectedQuantity: number | null;
    rejectedQuantity: number | null;
    quantityShipped: number | null;
    notes: string | null;
  }>;
}): Promise<{ ids: string[] }> {
  if (input.lines.length === 0) return { ids: [] };

  const ids: string[] = [];

  for (const l of input.lines) {
    const { rows } = await db.query<{ id: string }>(
      `
      INSERT INTO public.qc_daily_entries (
        submission_id,
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
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      RETURNING id
      `,
      [
        input.submissionId,
        input.entryTs,
        input.name,
        input.employeeNumber,
        input.salesOrder,
        l.detailNumber,
        l.flatOr3d,
        l.orderQuantity,
        l.inspectedQuantity,
        l.rejectedQuantity,
        l.quantityShipped,
        l.notes,
      ]
    );

    ids.push(rows[0].id);
  }

  return { ids };
}

export async function getQCSubmissionWithLines(submissionId: string): Promise<{
  submission: QCSubmission | null;
  lines: QCLine[];
}> {
  const subRes = await db.query<QCSubmission>(
    `
    SELECT
      id,
      entry_ts AS "entryTs",
      entry_date AS "entryDate",
      name,
      employee_number AS "employeeNumber",
      sales_order AS "salesOrder",
      notes,
      created_at AS "createdAt"
    FROM public.qc_daily_submissions
    WHERE id = $1
    LIMIT 1
    `,
    [submissionId]
  );

  const submission = subRes.rows[0] ?? null;
  if (!submission) return { submission: null, lines: [] };

  const linesRes = await db.query<QCLine>(
    `
    SELECT
      id,
      submission_id AS "submissionId",
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
    WHERE submission_id = $1
    ORDER BY created_at ASC, id ASC
    `,
    [submissionId]
  );

  return { submission, lines: linesRes.rows };
}

export async function replaceQCSubmission(input: {
  submissionId: string;
  entryTs: Date;
  name: string;
  employeeNumber: number;
  salesOrder: number | null;
  notes: string | null;
  lines: Array<{
    detailNumber: number | null;
    flatOr3d: string | null;
    orderQuantity: number | null;
    inspectedQuantity: number | null;
    rejectedQuantity: number | null;
    quantityShipped: number | null;
    notes: string | null;
  }>;
}): Promise<{ count: number }> {
  await db.query(
    `
    UPDATE public.qc_daily_submissions
    SET
      entry_ts = $2,
      name = $3,
      employee_number = $4,
      sales_order = $5,
      notes = $6
    WHERE id = $1
    `,
    [
      input.submissionId,
      input.entryTs,
      input.name,
      input.employeeNumber,
      input.salesOrder,
      input.notes,
    ]
  );

  // Replace lines
  await db.query(`DELETE FROM public.qc_daily_entries WHERE submission_id = $1`, [input.submissionId]);

  const inserted = await addQCLinesBulk({
    submissionId: input.submissionId,
    entryTs: input.entryTs,
    name: input.name,
    employeeNumber: input.employeeNumber,
    salesOrder: input.salesOrder,
    lines: input.lines,
  });

  return { count: inserted.ids.length };
}

export async function listQCSubmissionsForUserAndSO(input: {
  employeeNumber: number;
  salesOrder: number;
}): Promise<Array<{ id: string; entryTs: string; salesOrder: number | null; notes: string | null; lineCount: number }>> {
  const { rows } = await db.query(
    `
    SELECT
      s.id,
      s.entry_ts AS "entryTs",
      s.sales_order AS "salesOrder",
      s.notes,
      COUNT(e.id)::int AS "lineCount"
    FROM public.qc_daily_submissions s
    LEFT JOIN public.qc_daily_entries e
      ON e.submission_id = s.id
    WHERE s.employee_number = $1
      AND s.sales_order = $2
    GROUP BY s.id
    ORDER BY s.entry_ts DESC
    `,
    [input.employeeNumber, input.salesOrder]
  );

  return rows as any;
}

export async function listQCSubmissionSummariesByEntryDate(input: {
  entryDate: string;
  employeeNumber?: number; // if non-admin
}): Promise<Array<{
  id: string;
  entryTs: string;
  name: string;
  employeeNumber: number;
  salesOrder: number | null;
  notes: string | null;
  lineCount: number;
}>> {
  const params: any[] = [input.entryDate];
  let where = `s.entry_date = $1::date`;

  if (input.employeeNumber != null) {
    params.push(input.employeeNumber);
    where += ` AND s.employee_number = $2`;
  }

  const { rows } = await db.query(
    `
    SELECT
      s.id,
      s.entry_ts AS "entryTs",
      s.name,
      s.employee_number AS "employeeNumber",
      s.sales_order AS "salesOrder",
      s.notes,
      COUNT(e.id)::int AS "lineCount"
    FROM public.qc_daily_submissions s
    LEFT JOIN public.qc_daily_entries e
      ON e.submission_id = s.id
    WHERE ${where}
    GROUP BY s.id
    ORDER BY s.entry_ts DESC
    `,
    params
  );

  return rows as any;
}
