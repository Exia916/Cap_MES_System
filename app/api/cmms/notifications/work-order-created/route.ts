import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { getAuthFromRequest } from "@/lib/auth";

export const runtime = "nodejs";

function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function toBool(v: string | undefined) {
  return String(v || "").toLowerCase() === "true";
}

function escapeHtml(s: any) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function toId(v: any): number | null {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export async function POST(req: NextRequest) {
  try {
    const auth = getAuthFromRequest(req);
    if (!auth) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const wo = body?.workOrder;
    if (!wo) return NextResponse.json({ error: "Missing workOrder payload" }, { status: 400 });

    const id = toId(wo.workOrderId);

    const host = mustEnv("SMTP_HOST");
    const port = Number(mustEnv("SMTP_PORT"));
    const secure = toBool(process.env.SMTP_SECURE);

    const user = mustEnv("SMTP_USER");
    const pass = mustEnv("SMTP_PASS");

    const from = mustEnv("CMMS_NOTIFY_FROM");
    const to = mustEnv("CMMS_NOTIFY_TO"); // comma-separated allowed

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure, // true for 465, false for 587/STARTTLS
      auth: { user, pass },
      // If SurgeMail uses a self-signed cert, you MAY need:
      // tls: { rejectUnauthorized: false },
    });

    const dept = wo.department || "Unknown Dept";
    const asset = wo.asset || "Unknown Asset";

    const subject = `CMMS Repair Request Created${id ? ` (#${id})` : ""} - ${dept} / ${asset}`;

    const html = `
      <div style="font-family: Arial, Helvetica, sans-serif; color:#111827;">
        <h2 style="margin:0 0 8px 0;">New Repair Request Created</h2>

        ${
          id
            ? `<div style="margin: 0 0 12px 0; font-size: 13px;">
                 <b>Work Order ID:</b> ${escapeHtml(String(id))}
               </div>`
            : `<div style="margin: 0 0 12px 0; font-size: 13px; color:#6b7280;">
                 <b>Work Order ID:</b> (not provided by API)
               </div>`
        }

        <table cellpadding="6" cellspacing="0" style="border-collapse:collapse; font-size: 13px;">
          <tr><td><b>Submitted By</b></td><td>${escapeHtml(wo.requestedByName || "—")}</td></tr>
          <tr><td><b>Department</b></td><td>${escapeHtml(dept)}</td></tr>
          <tr><td><b>Asset</b></td><td>${escapeHtml(asset)}</td></tr>
          <tr><td><b>Priority</b></td><td>${escapeHtml(wo.priority || "—")}</td></tr>
          <tr><td><b>Common Issue</b></td><td>${escapeHtml(wo.commonIssue || "—")}</td></tr>
          <tr><td><b>Operator Initials</b></td><td>${escapeHtml(wo.operatorInitials || "—")}</td></tr>
        </table>

        <h3 style="margin:14px 0 6px 0;">Issue / Notes</h3>
        <pre style="white-space:pre-wrap; background:#f9fafb; border:1px solid #e5e7eb; padding:10px; border-radius:8px; font-size: 13px;">${escapeHtml(
          wo.issueDialogue || ""
        )}</pre>
      </div>
    `;

    await transporter.sendMail({
      from,
      to,
      subject,
      html,
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Email failed" }, { status: 500 });
  }
}