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

// ------------------------------
// Range + filters + paging list
// ------------------------------

export type QCSubmissionSummaryRow = {
  id: string;
  entryTs: string;
  entryDate: string;
  name: string;
  employeeNumber: number;
  salesOrder: number | null;
  notes: string | null;
  createdAt: string;
  lineCount: number;
};

export type ListQCSubmissionSummariesArgs = {
  entryDateFrom: string; // YYYY-MM-DD
  entryDateTo: string;   // YYYY-MM-DD
  employeeNumber?: number; // non-admin restriction

  // filters
  name?: string;                  // contains
  notes?: string;                 // contains (submission notes OR any line notes)
  salesOrderStartsWith?: string;  // starts-with on submission sales_order
  detailStartsWith?: string;      // starts-with on ANY line.detail_number

  // sort + paging
  sortBy?: "entryTs" | "entryDate" | "name" | "salesOrder" | "lineCount";
  sortDir?: "asc" | "desc";
  limit: number;
  offset: number;
};

export async function listQCSubmissionSummariesRange(
  input: ListQCSubmissionSummariesArgs
): Promise<{ rows: QCSubmissionSummaryRow[]; totalCount: number }> {
  const params: any[] = [input.entryDateFrom, input.entryDateTo];

  let where = `s.entry_date BETWEEN $1::date AND $2::date`;

  if (input.employeeNumber != null) {
    params.push(input.employeeNumber);
    where += ` AND s.employee_number = $${params.length}`;
  }

  if (input.name?.trim()) {
    params.push(`%${input.name.trim()}%`);
    where += ` AND s.name ILIKE $${params.length}`;
  }

  if (input.salesOrderStartsWith?.trim()) {
    params.push(`${input.salesOrderStartsWith.trim()}%`);
    where += ` AND COALESCE(s.sales_order::text,'') LIKE $${params.length}`;
  }

  if (input.detailStartsWith?.trim()) {
    params.push(`${input.detailStartsWith.trim()}%`);
    where += `
      AND EXISTS (
        SELECT 1
        FROM public.qc_daily_entries e2
        WHERE e2.submission_id = s.id
          AND COALESCE(e2.detail_number::text,'') LIKE $${params.length}
      )
    `;
  }

  if (input.notes?.trim()) {
    params.push(`%${input.notes.trim()}%`);
    where += `
      AND (
        COALESCE(s.notes,'') ILIKE $${params.length}
        OR EXISTS (
          SELECT 1
          FROM public.qc_daily_entries e3
          WHERE e3.submission_id = s.id
            AND COALESCE(e3.notes,'') ILIKE $${params.length}
        )
      )
    `;
  }

  const sortBy = input.sortBy ?? "entryTs";
  const sortDir = input.sortDir === "asc" ? "ASC" : "DESC";

  // ✅ IMPORTANT: ORDER BY must reference "b" columns (outer query), NOT s/e
  const ORDER_MAP_B: Record<string, string> = {
    entryTs: `b."entryTs"`,
    entryDate: `b."entryDate"`,
    name: `b."name"`,
    salesOrder: `b."salesOrder"`,
    lineCount: `b."lineCount"`,
  };

  const orderExpr = ORDER_MAP_B[sortBy] ?? ORDER_MAP_B.entryTs;
  const orderBySql = `${orderExpr} ${sortDir}, b."id" DESC`;

  params.push(input.limit);
  const limitParam = `$${params.length}`;
  params.push(input.offset);
  const offsetParam = `$${params.length}`;

  const { rows } = await db.query(
    `
    WITH base AS (
      SELECT
        s.id,
        s.entry_ts AS "entryTs",
        s.entry_date AS "entryDate",
        s.name AS "name",
        s.employee_number AS "employeeNumber",
        s.sales_order AS "salesOrder",
        s.notes AS "notes",
        s.created_at AS "createdAt",
        COUNT(e.id)::int AS "lineCount"
      FROM public.qc_daily_submissions s
      LEFT JOIN public.qc_daily_entries e
        ON e.submission_id = s.id
      WHERE ${where}
      GROUP BY s.id
    )
    SELECT
      b.*,
      (SELECT COUNT(*) FROM base)::int AS "totalCount"
    FROM base b
    ORDER BY ${orderBySql}
    LIMIT ${limitParam}
    OFFSET ${offsetParam}
    `,
    params
  );

  const totalCount = rows.length ? Number((rows[0] as any).totalCount) : 0;
  const clean = rows.map(({ totalCount: _tc, ...rest }: any) => rest) as QCSubmissionSummaryRow[];

  return { rows: clean, totalCount };
}
