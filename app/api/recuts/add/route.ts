import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import { createRecutRequest } from "@/lib/repositories/recutRepo";
import { logAuditEvent, logError, logWarn } from "@/lib/logging/logger";
import { normalizeSalesOrder } from "@/lib/utils/salesOrder";

export const runtime = "nodejs";

type Resp = { id: string; recutId: number } | { error: string };

const ALLOWED_ROLES = new Set(["ADMIN", "MANAGER", "SUPERVISOR", "USER"]);

function roleOk(role: string | null | undefined) {
  return ALLOWED_ROLES.has(String(role || "").trim().toUpperCase());
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

export async function POST(req: NextRequest) {
  let auth: ReturnType<typeof getAuthFromRequest> | null = null;

  try {
    auth = await getAuthFromRequest(req as any);

    if (!auth) {
      return NextResponse.json<Resp>({ error: "Unauthorized" }, { status: 401 });
    }

    if (!roleOk((auth as any).role)) {
      await logWarn({
        req,
        auth,
        category: "API",
        module: "RECUT",
        eventType: "RECUT_CREATE_FORBIDDEN",
        message: "User attempted to create a recut request without permission",
      });

      return NextResponse.json<Resp>({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      await logWarn({
        req,
        auth,
        category: "API",
        module: "RECUT",
        eventType: "RECUT_CREATE_INVALID",
        message: "Recut create request received invalid body",
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

    const supervisorApproved = !!(body as any).supervisorApproved;
    const warehousePrinted = !!(body as any).warehousePrinted;

    if (!requestedDepartment) {
      await logWarn({
        req,
        auth,
        category: "API",
        module: "RECUT",
        eventType: "RECUT_CREATE_INVALID",
        message: "Recut create request failed validation",
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
        eventType: "RECUT_CREATE_INVALID",
        message: "Recut create request failed validation",
        details: {
          reason: "INVALID_SALES_ORDER_FORMAT",
          salesOrder: rawSalesOrder,
        },
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
        eventType: "RECUT_CREATE_INVALID",
        message: "Recut create request failed validation",
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
        eventType: "RECUT_CREATE_INVALID",
        message: "Recut create request failed validation",
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
        eventType: "RECUT_CREATE_INVALID",
        message: "Recut create request failed validation",
        details: {
          reason: "INVALID_DETAIL_NUMBER",
          detailNumber: (body as any).detailNumber ?? null,
        },
      });

      return NextResponse.json<Resp>({ error: "Detail # must be a whole number." }, { status: 400 });
    }

    if (!capStyle) {
      await logWarn({
        req,
        auth,
        category: "API",
        module: "RECUT",
        eventType: "RECUT_CREATE_INVALID",
        message: "Recut create request failed validation",
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
        eventType: "RECUT_CREATE_INVALID",
        message: "Recut create request failed validation",
        details: {
          reason: "INVALID_PIECES",
          pieces: (body as any).pieces ?? null,
        },
      });

      return NextResponse.json<Resp>({ error: "Pieces must be greater than 0." }, { status: 400 });
    }

    if (!deliverTo) {
      await logWarn({
        req,
        auth,
        category: "API",
        module: "RECUT",
        eventType: "RECUT_CREATE_INVALID",
        message: "Recut create request failed validation",
        details: { reason: "DELIVER_TO_REQUIRED" },
      });

      return NextResponse.json<Resp>({ error: "Deliver To is required." }, { status: 400 });
    }

    const authRole = String((auth as any).role ?? "").trim().toUpperCase();
    const authDept = normalizeDept((auth as any).department ?? null);
    const authName = String((auth as any).displayName ?? (auth as any).username ?? "").trim();

    if (isEmbDept(authDept)) {
      operator = authName;
    }

    if (!operator) {
      await logWarn({
        req,
        auth,
        category: "API",
        module: "RECUT",
        eventType: "RECUT_CREATE_INVALID",
        message: "Recut create request failed validation",
        details: { reason: "OPERATOR_REQUIRED" },
      });

      return NextResponse.json<Resp>({ error: "Operator is required." }, { status: 400 });
    }

    const canSetFlags =
      authRole === "ADMIN" || authRole === "MANAGER" || authRole === "SUPERVISOR";

    const requestedByUserId = (auth as any).userId != null ? String((auth as any).userId) : null;
    const requestedByUsername = (auth as any).username != null ? String((auth as any).username) : null;
    const requestedByEmployeeNumber =
      (auth as any).employeeNumber != null
        ? Number((auth as any).employeeNumber)
        : (auth as any).userId != null
          ? Number((auth as any).userId)
          : null;

    const result = await createRecutRequest({
      requestedByUserId,
      requestedByUsername,
      requestedByName: authName,
      requestedByEmployeeNumber,

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

      supervisorApproved: canSetFlags ? supervisorApproved : false,
      supervisorApprovedAt: canSetFlags && supervisorApproved ? new Date() : null,
      supervisorApprovedBy: canSetFlags && supervisorApproved ? authName : null,

      warehousePrinted: canSetFlags ? warehousePrinted : false,
      warehousePrintedAt: canSetFlags && warehousePrinted ? new Date() : null,
      warehousePrintedBy: canSetFlags && warehousePrinted ? authName : null,

      doNotPull: false,
      doNotPullAt: null,
      doNotPullBy: null,
    });

    await logAuditEvent({
      req,
      auth,
      module: "RECUT",
      eventType: "RECUT_CREATED",
      message: "Recut request created",
      recordType: "recut_requests",
      recordId: result.id,
      details: {
        recutId: result.recutId,
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
        supervisorApproved: canSetFlags ? supervisorApproved : false,
        warehousePrinted: canSetFlags ? warehousePrinted : false,
      },
    });

    return NextResponse.json<Resp>(result, { status: 201 });
  } catch (err: any) {
    await logError({
      req,
      auth,
      category: "API",
      module: "RECUT",
      eventType: "RECUT_CREATE_ERROR",
      message: "Failed to create recut request",
      recordType: "recut_requests",
      error: err,
      details: {
        code: err?.code ?? null,
        detail: err?.detail ?? null,
      },
    });

    console.error("recut add POST error:", err);
    return NextResponse.json<Resp>({ error: "Server error" }, { status: 500 });
  }
}