import { db } from "@/lib/db";

export type ActivityHistoryRow = {
  id: number;
  entityType: string;
  entityId: string;
  eventType: string;
  fieldName: string | null;
  previousValue: unknown | null;
  newValue: unknown | null;
  message: string | null;
  module: string | null;
  userId: string | null;
  userName: string | null;
  employeeNumber: number | null;
  salesOrder: number | null;
  detailNumber: number | null;
  createdAt: string;
};

export type CreateActivityHistoryInput = {
  entityType: string;
  entityId: string;
  eventType: string;
  fieldName?: string | null;
  previousValue?: unknown;
  newValue?: unknown;
  message?: string | null;
  module?: string | null;
  userId?: string | null;
  userName?: string | null;
  employeeNumber?: number | null;
  salesOrder?: number | null;
  detailNumber?: number | null;
};

function toJsonOrNull(v: unknown): string | null {
  if (v === undefined || v === null) return null;
  return JSON.stringify(v);
}

export async function createActivityHistory(input: CreateActivityHistoryInput): Promise<void> {
  await db.query(
    `
      insert into public.activity_history (
        entity_type,
        entity_id,
        event_type,
        field_name,
        previous_value,
        new_value,
        message,
        module,
        user_id,
        user_name,
        employee_number,
        sales_order,
        detail_number
      )
      values (
        $1, $2, $3, $4,
        $5::jsonb, $6::jsonb,
        $7, $8, $9, $10, $11, $12, $13
      )
    `,
    [
      input.entityType,
      input.entityId,
      input.eventType,
      input.fieldName ?? null,
      toJsonOrNull(input.previousValue),
      toJsonOrNull(input.newValue),
      input.message ?? null,
      input.module ?? null,
      input.userId ?? null,
      input.userName ?? null,
      input.employeeNumber ?? null,
      input.salesOrder ?? null,
      input.detailNumber ?? null,
    ]
  );
}

export async function listActivityHistoryByEntity(
  entityType: string,
  entityId: string,
  limit = 100
): Promise<ActivityHistoryRow[]> {
  const { rows } = await db.query(
    `
      select
        id,
        entity_type as "entityType",
        entity_id as "entityId",
        event_type as "eventType",
        field_name as "fieldName",
        previous_value as "previousValue",
        new_value as "newValue",
        message,
        module,
        user_id as "userId",
        user_name as "userName",
        employee_number as "employeeNumber",
        sales_order as "salesOrder",
        detail_number as "detailNumber",
        created_at as "createdAt"
      from public.activity_history
      where entity_type = $1
        and entity_id = $2
      order by created_at desc, id desc
      limit $3
    `,
    [entityType, entityId, limit]
  );

  return rows;
}

export async function listActivityHistoryBySalesOrder(
  salesOrder: number,
  detailNumber?: number | null,
  limit = 100
): Promise<ActivityHistoryRow[]> {
  const params: any[] = [salesOrder];
  let where = `sales_order = $1`;

  if (detailNumber !== undefined && detailNumber !== null) {
    params.push(detailNumber);
    where += ` and detail_number = $2`;
  }

  params.push(limit);

  const { rows } = await db.query(
    `
      select
        id,
        entity_type as "entityType",
        entity_id as "entityId",
        event_type as "eventType",
        field_name as "fieldName",
        previous_value as "previousValue",
        new_value as "newValue",
        message,
        module,
        user_id as "userId",
        user_name as "userName",
        employee_number as "employeeNumber",
        sales_order as "salesOrder",
        detail_number as "detailNumber",
        created_at as "createdAt"
      from public.activity_history
      where ${where}
      order by created_at desc, id desc
      limit $${params.length}
    `,
    params
  );

  return rows;
}