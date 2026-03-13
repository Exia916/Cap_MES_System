import { NextRequest, NextResponse } from "next/server";
import {
  canUserEditOwnRecutRequest,
  getRecutRequestById,
  updateRecutRequest,
} from "@/lib/repositories/recutRepo";
import { getAuthFromRequest } from "@/lib/auth";
import { logAuditEvent, logError, logWarn } from "@/lib/logging/logger";
import { normalizeSalesOrder } from "@/lib/utils/salesOrder";

export const runtime = "nodejs";

type Resp = { entry: any } | { ok: true } | { error: string };

const VIEW_ROLES = new Set(["ADMIN", "MANAGER", "SUPERVISOR", "USER", "WAREHOUSE"]);
const EDIT_MANAGER_ROLES = new Set(["ADMIN", "MANAGER", "SUPERVISOR"]);

function roleOk(role: string | null | undefined, allowed: Set<string>) {
  return allowed.has(String(role || "").trim().toUpperCase());
}

function normalizeDept(value: string | null | undefined): string {
  const v = String(value ?? "").trim().toUpperCase();
  if (v === "EMBROIDERY") return "Embroidery";
  if (v === "ANNEX EMB") return "Annex Embroidery";
  if (v === "ANNEX EMBROIDERY") return "Annex Embroidery";
  if (v === "SAMPLE EMBROIDERY") return "Sample Embroidery";
  if (v === "QC") return "QC";
  return "";
}

function isEmbDept(value: string | null | undefined) {
  const v = normalizeDept(value);
  return v === "Embroidery" || v === "Annex Embroidery" || v === "Sample Embroidery";
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  let auth: ReturnType<typeof getAuthFromRequest> | null = null;
  let id = "";

  try {
    auth = await getAuthFromRequest(req as any);
    if (!auth) return NextResponse.json<Resp>({ error: "Unauthorized" }, { status: 401 });

    if (!roleOk((auth as any).role, VIEW_ROLES)) {
      await logWarn({
        req,
        auth,
        category: "API",
        module: "RECUT",
        eventType: "RECUT_VIEW_FORBIDDEN",
        message: "User attempted to view recut request without permission",
      });

      return NextResponse.json<Resp>({ error: "Forbidden" }, { status: 403 });
    }

    const params = await ctx.params;
    id = String(params?.id || "").trim();

    const entry = await getRecutRequestById(id);

    if (!entry) {
      await logWarn({
        req,
        auth,
        category: "API",
        module: "RECUT",
        eventType: "RECUT_NOT_FOUND",
        message: "Recut request not found",
        recordType: "recut_requests",
        recordId: id || null,
      });

      return NextResponse.json<Resp>({ error: "Not found" }, { status: 404 });
    }

    const authRole = String((auth as any).role ?? "").trim().toUpperCase();
    const employeeNumber =
      (auth as any).employeeNumber != null
        ? Number((auth as any).employeeNumber)
        : (auth as any).userId != null
          ? Number((auth as any).userId)
          : null;

    const isManager = EDIT_MANAGER_ROLES.has(authRole);
    const isOwner =
      employeeNumber != null &&
      Number(entry.requestedByEmployeeNumber ?? -1) === Number(employeeNumber);

    if (!isManager && !isOwner) {
      await logWarn({
        req,
        auth,
        category: "API",
        module: "RECUT",
        eventType: "RECUT_VIEW_NOT_OWNER",
        message: "User attempted to view another user's recut request",
        recordType: "recut_requests",
        recordId: id,
        details: {
          requestedByEmployeeNumber: entry.requestedByEmployeeNumber ?? null,
          authEmployeeNumber: employeeNumber,
        },
      });

      return NextResponse.json<Resp>({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json<Resp>({ entry }, { status: 200 });
  } catch (err: any) {
    await logError({
      req,
      auth,
      category: "API",
      module: "RECUT",
      eventType: "RECUT_VIEW_ERROR",
      message: "Failed to load recut request",
      recordType: "recut_requests",
      recordId: id || null,
      error: err,
      details: {
        code: err?.code ?? null,
        detail: err?.detail ?? null,
      },
    });

    console.error("recut GET by id error:", err);
    return NextResponse.json<Resp>({ error: "Server error" }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  let auth: ReturnType<typeof getAuthFromRequest> | null = null;
  let id = "";

  try {
    auth = await getAuthFromRequest(req as any);
    if (!auth) return NextResponse.json<Resp>({ error: "Unauthorized" }, { status: 401 });

    if (!roleOk((auth as any).role, VIEW_ROLES)) {
      await logWarn({
        req,
        auth,
        category: "API",
        module: "RECUT",
        eventType: "RECUT_UPDATE_FORBIDDEN",
        message: "User attempted to update recut request without permission",
      });

      return NextResponse.json<Resp>({ error: "Forbidden" }, { status: 403 });
    }

    const params = await ctx.params;
    id = String(params?.id || "").trim();

    const current = await getRecutRequestById(id);

    if (!current) {
      await logWarn({
        req,
        auth,
        category: "API",
        module: "RECUT",
        eventType: "RECUT_NOT_FOUND",
        message: "Recut request not found during update",
        recordType: "recut_requests",
        recordId: id || null,
      });

      return NextResponse.json<Resp>({ error: "Not found" }, { status: 404 });
    }

    const authRole = String((auth as any).role ?? "").trim().toUpperCase();
    const authName = String((auth as any).displayName ?? (auth as any).username ?? "").trim();
    const employeeNumber =
      (auth as any).employeeNumber != null
        ? Number((auth as any).employeeNumber)
        : (auth as any).userId != null
          ? Number((auth as any).userId)
          : null;

    const isManager = EDIT_MANAGER_ROLES.has(authRole);

    if (!isManager) {
      if (!employeeNumber || !Number.isFinite(employeeNumber)) {
        await logWarn({
          req,
          auth,
          category: "API",
          module: "RECUT",
          eventType: "RECUT_UPDATE_INVALID_AUTH_CONTEXT",
          message: "Recut update failed due to missing employee number in auth payload",
          recordType: "recut_requests",
          recordId: id,
        });

        return NextResponse.json<Resp>(
          { error: "Missing employee number in auth payload." },
          { status: 400 }
        );
      }

      const canEdit = await canUserEditOwnRecutRequest({
        id,
        employeeNumber,
      });

      if (!canEdit) {
        await logWarn({
          req,
          auth,
          category: "API",
          module: "RECUT",
          eventType: "RECUT_UPDATE_LOCKED",
          message: "User attempted to edit a recut request that can no longer be edited",
          recordType: "recut_requests",
          recordId: id,
          details: {
            employeeNumber,
            supervisorApproved: current.supervisorApproved,
            warehousePrinted: current.warehousePrinted,
          },
        });

        return NextResponse.json<Resp>(
          { error: "This recut request can no longer be edited." },
          { status: 403 }
        );
      }
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      await logWarn({
        req,
        auth,
        category: "API",
        module: "RECUT",
        eventType: "RECUT_UPDATE_INVALID",
        message: "Recut update received invalid request body",
        recordType: "recut_requests",
        recordId: id,
        details: {
          reason: "INVALID_REQUEST_BODY",
        },
      });

      return NextResponse.json<Resp>({ error: "Invalid request body." }, { status: 400 });
    }

    const requestedDepartment = String((body as any).requestedDepartment ?? "").trim();
    const rawSalesOrder = String((body as any).salesOrder ?? "").trim();
    const designName = String((body as any).designName ?? "").trim();
    const recutReason = String((body as any).recutReason ?? "").trim();
    const detailNumber = Number((body as any).detailNumber);
    const capStyle = String((body as any).capStyle ?? "").trim();
    const pieces = Number((body as any).pieces);
    let operator = String((body as any).operator ?? "").trim();
    const deliverTo = String((body as any).deliverTo ?? "").trim();
    const notes = String((body as any).notes ?? "").trim();
    const event = !!(body as any).event;

    let supervisorApproved = !!(body as any).supervisorApproved;
    let warehousePrinted = !!(body as any).warehousePrinted;
    let doNotPull = !!(body as any).doNotPull;

    if (!requestedDepartment) {
      await logWarn({
        req,
        auth,
        category: "API",
        module: "RECUT",
        eventType: "RECUT_UPDATE_INVALID",
        message: "Recut update failed validation",
        recordType: "recut_requests",
        recordId: id,
        details: { reason: "REQUESTED_DEPARTMENT_REQUIRED" },
      });

      return NextResponse.json<Resp>({ error: "Requested Department is required." }, { status: 400 });
    }

    const normalizedSO = normalizeSalesOrder(rawSalesOrder);
    if (!normalizedSO.isValid || !normalizedSO.salesOrderDisplay || !normalizedSO.salesOrderBase) {
      await logWarn({
        req,
        auth,
        category: "API",
        module: "RECUT",
        eventType: "RECUT_UPDATE_INVALID",
        message: "Recut update failed validation",
        recordType: "recut_requests",
        recordId: id,
        details: { reason: "INVALID_SALES_ORDER_FORMAT", salesOrder: rawSalesOrder },
      });

      return NextResponse.json<Resp>(
        { error: normalizedSO.error ?? "Sales Order must begin with 7 digits." },
        { status: 400 }
      );
    }

    if (!designName) {
      await logWarn({
        req,
        auth,
        category: "API",
        module: "RECUT",
        eventType: "RECUT_UPDATE_INVALID",
        message: "Recut update failed validation",
        recordType: "recut_requests",
        recordId: id,
        details: { reason: "DESIGN_NAME_REQUIRED" },
      });

      return NextResponse.json<Resp>({ error: "Design Name is required." }, { status: 400 });
    }

    if (!recutReason) {
      await logWarn({
        req,
        auth,
        category: "API",
        module: "RECUT",
        eventType: "RECUT_UPDATE_INVALID",
        message: "Recut update failed validation",
        recordType: "recut_requests",
        recordId: id,
        details: { reason: "RECUT_REASON_REQUIRED" },
      });

      return NextResponse.json<Resp>({ error: "Recut Reason is required." }, { status: 400 });
    }

    if (!Number.isInteger(detailNumber) || detailNumber < 0) {
      await logWarn({
        req,
        auth,
        category: "API",
        module: "RECUT",
        eventType: "RECUT_UPDATE_INVALID",
        message: "Recut update failed validation",
        recordType: "recut_requests",
        recordId: id,
        details: { reason: "INVALID_DETAIL_NUMBER", detailNumber: (body as any).detailNumber ?? null },
      });

      return NextResponse.json<Resp>({ error: "Detail # must be a whole number." }, { status: 400 });
    }

    if (!capStyle) {
      await logWarn({
        req,
        auth,
        category: "API",
        module: "RECUT",
        eventType: "RECUT_UPDATE_INVALID",
        message: "Recut update failed validation",
        recordType: "recut_requests",
        recordId: id,
        details: { reason: "CAP_STYLE_REQUIRED" },
      });

      return NextResponse.json<Resp>({ error: "Cap Style is required." }, { status: 400 });
    }

    if (!Number.isInteger(pieces) || pieces <= 0) {
      await logWarn({
        req,
        auth,
        category: "API",
        module: "RECUT",
        eventType: "RECUT_UPDATE_INVALID",
        message: "Recut update failed validation",
        recordType: "recut_requests",
        recordId: id,
        details: { reason: "INVALID_PIECES", pieces: (body as any).pieces ?? null },
      });

      return NextResponse.json<Resp>({ error: "Pieces must be greater than 0." }, { status: 400 });
    }

    if (!deliverTo) {
      await logWarn({
        req,
        auth,
        category: "API",
        module: "RECUT",
        eventType: "RECUT_UPDATE_INVALID",
        message: "Recut update failed validation",
        recordType: "recut_requests",
        recordId: id,
        details: { reason: "DELIVER_TO_REQUIRED" },
      });

      return NextResponse.json<Resp>({ error: "Deliver To is required." }, { status: 400 });
    }

    const authDept = normalizeDept((auth as any).department ?? null);
    if (isEmbDept(authDept)) {
      operator = authName;
    }

    if (!operator) {
      await logWarn({
        req,
        auth,
        category: "API",
        module: "RECUT",
        eventType: "RECUT_UPDATE_INVALID",
        message: "Recut update failed validation",
        recordType: "recut_requests",
        recordId: id,
        details: { reason: "OPERATOR_REQUIRED" },
      });

      return NextResponse.json<Resp>({ error: "Operator is required." }, { status: 400 });
    }

    if (!isManager) {
      supervisorApproved = current.supervisorApproved;
      warehousePrinted = current.warehousePrinted;
      doNotPull = current.doNotPull;
    }

    await updateRecutRequest({
      id,
      requestedDepartment,
      salesOrder: normalizedSO.salesOrderDisplay,
      salesOrderBase: normalizedSO.salesOrderBase,
      salesOrderDisplay: normalizedSO.salesOrderDisplay,
      designName,
      recutReason,
      detailNumber,
      capStyle,
      pieces,
      operator,
      deliverTo,
      notes: notes || null,
      event,

      supervisorApproved,
      supervisorApprovedAt:
        supervisorApproved && !current.supervisorApproved
          ? new Date()
          : current.supervisorApprovedAt
            ? new Date(current.supervisorApprovedAt)
            : null,
      supervisorApprovedBy:
        supervisorApproved && !current.supervisorApproved
          ? authName
          : current.supervisorApprovedBy,

      warehousePrinted,
      warehousePrintedAt:
        warehousePrinted && !current.warehousePrinted
          ? new Date()
          : current.warehousePrintedAt
            ? new Date(current.warehousePrintedAt)
            : null,
      warehousePrintedBy:
        warehousePrinted && !current.warehousePrinted
          ? authName
          : current.warehousePrintedBy,

      doNotPull,
      doNotPullAt:
        doNotPull && !current.doNotPull
          ? new Date()
          : current.doNotPullAt
            ? new Date(current.doNotPullAt)
            : null,
      doNotPullBy:
        doNotPull && !current.doNotPull
          ? authName
          : !doNotPull
            ? null
            : current.doNotPullBy,
    });

    await logAuditEvent({
      req,
      auth,
      module: "RECUT",
      eventType: "RECUT_UPDATED",
      message: "Recut request updated",
      recordType: "recut_requests",
      recordId: id,
      details: {
        requestedDepartment,
        salesOrder: normalizedSO.salesOrderDisplay,
        salesOrderBase: normalizedSO.salesOrderBase,
        designName,
        recutReason,
        detailNumber,
        capStyle,
        pieces,
        operator,
        deliverTo,
        event,
      },
    });

    if (supervisorApproved !== Boolean(current.supervisorApproved)) {
      await logAuditEvent({
        req,
        auth,
        module: "RECUT",
        eventType: supervisorApproved ? "RECUT_SUPERVISOR_APPROVED" : "RECUT_SUPERVISOR_APPROVAL_REMOVED",
        message: supervisorApproved
          ? "Recut request supervisor approval set"
          : "Recut request supervisor approval removed",
        recordType: "recut_requests",
        recordId: id,
      });
    }

    if (warehousePrinted !== Boolean(current.warehousePrinted)) {
      await logAuditEvent({
        req,
        auth,
        module: "RECUT",
        eventType: warehousePrinted ? "RECUT_WAREHOUSE_PRINTED_SET" : "RECUT_WAREHOUSE_PRINTED_REMOVED",
        message: warehousePrinted
          ? "Recut request warehouse printed flag set"
          : "Recut request warehouse printed flag removed",
        recordType: "recut_requests",
        recordId: id,
      });
    }

    if (doNotPull !== Boolean(current.doNotPull)) {
      await logAuditEvent({
        req,
        auth,
        module: "RECUT",
        eventType: doNotPull ? "RECUT_DO_NOT_PULL_SET" : "RECUT_DO_NOT_PULL_REMOVED",
        message: doNotPull
          ? "Recut request marked do not pull"
          : "Recut request do not pull removed",
        recordType: "recut_requests",
        recordId: id,
      });
    }

    return NextResponse.json<Resp>({ ok: true }, { status: 200 });
  } catch (err: any) {
    await logError({
      req,
      auth,
      category: "API",
      module: "RECUT",
      eventType: "RECUT_UPDATE_ERROR",
      message: "Failed to update recut request",
      recordType: "recut_requests",
      recordId: id || null,
      error: err,
      details: {
        code: err?.code ?? null,
        detail: err?.detail ?? null,
      },
    });

    console.error("recut PUT by id error:", err);
    return NextResponse.json<Resp>({ error: "Server error" }, { status: 500 });
  }
}