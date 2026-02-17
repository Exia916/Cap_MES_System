// pages/api/admin/qc-daily-production-all.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getAuthFromRequest } from "../../../lib/auth";
import { getSheetsClient } from "../../../lib/googleSheets";

const SHEET_ID = process.env.GOOGLE_SHEET_ID as string;

const QC_SHEET_NAME = "QC Daily Production";
const USERS_SHEET_NAME = "Emb Users";

type QcRow = {
  rowNumber: number;   // actual sheet row (2, 3, 4, ...)
  values: string[];    // columns A..R
};

type SuccessResponse = {
  headers: string[];   // column headers A..R
  entries: QcRow[];
};

type ErrorResponse = { error: string };

type ApiResponse = SuccessResponse | ErrorResponse;

// ---- Helpers ----

// Find a column index by header name (case-insensitive, supports synonyms)
function findColumnIndex(
  headers: string[],
  names: string[]
): number | null {
  const lowered = headers.map((h) => (h ?? "").toString().trim().toLowerCase());
  for (const name of names) {
    const target = name.toLowerCase();
    const idx = lowered.indexOf(target);
    if (idx !== -1) return idx;
  }
  return null;
}

// Return all roles for the current user (e.g. ["Admin", "Supervisor"])
async function getUserRoles(
  sheets: any,
  auth: { username?: string; displayName?: string }
): Promise<string[]> {
  const username = (auth.username ?? "").toString().trim().toLowerCase();
  const displayName = (auth.displayName ?? "").toString().trim().toLowerCase();

  // 1) Read header row to figure out which columns are Name / Username / Role
  const headerRange = `${USERS_SHEET_NAME}!A1:Z1`;
  const headerResp = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: headerRange,
  });

  const headerRow = (headerResp.data.values?.[0] || []) as string[];
  const headers = headerRow.map((h) => h?.toString() ?? "");

  const nameCol = findColumnIndex(headers, ["name"]);
  const usernameCol = findColumnIndex(headers, ["username", "user"]);
  const roleCol = findColumnIndex(headers, ["role", "roles"]);

  if (roleCol == null) {
    console.warn("Could not find Role column in Emb Users header row");
    return [];
  }

  // 2) Read data rows A2:Z
  const dataRange = `${USERS_SHEET_NAME}!A2:Z`;
  const dataResp = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: dataRange,
  });

  const rows = dataResp.data.values || [];
  const roles: string[] = [];

  const norm = (v: any) =>
    (v ?? "").toString().trim().replace(/\s+/g, " ").toLowerCase();

  for (const row of rows) {
    const cells = row as string[];

    const nameCell = nameCol != null ? norm(cells[nameCol]) : "";
    const userCell = usernameCol != null ? norm(cells[usernameCol]) : "";

    // STRONG MATCHING: exact username OR exact displayName (case-insensitive)
    let matchesUser = false;
    if (username && userCell === username) {
      matchesUser = true;
    } else if (displayName && nameCell === displayName) {
      matchesUser = true;
    }

    if (!matchesUser) continue;

    const roleCellRaw = (cells[roleCol] ?? "").toString().trim();
    if (!roleCellRaw) continue;

    // Support multiple roles separated by comma/semicolon
    const splitRoles = roleCellRaw
      .split(/[;,]/)
      .map((r) => r.trim())
      .filter((r) => r.length > 0);

    roles.push(...splitRoles);

    // Found the row for this user; no need to keep scanning
    break;
  }

  return roles;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse>
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const auth = getAuthFromRequest(req);
  if (!auth) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const { sheets } = await getSheetsClient();

    // ---- Role check (Admin or Supervisor) ----
    const roles = await getUserRoles(sheets, auth);
    const lowerRoles = roles.map((r) => r.toLowerCase());

    const allowed = lowerRoles.some(
      (r) => r === "admin" || r === "supervisor"
    );

    if (!allowed) {
      return res.status(403).json({
        error: "Forbidden: you do not have access to this data",
      });
    }

    // ---- Headers A1:R1 ----
    const headerRange = `${QC_SHEET_NAME}!A1:R1`;
    const headerResp = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: headerRange,
    });

    const headerRow = (headerResp.data.values?.[0] || []) as string[];
    const headers: string[] = headerRow.map((h) => h?.toString() ?? "");

    // ---- Data rows A2:R ----
    const dataRange = `${QC_SHEET_NAME}!A2:R`;
    const dataResp = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: dataRange,
    });

    const rows = dataResp.data.values || [];

    const entries: QcRow[] = rows.map((row, index) => ({
      rowNumber: index + 2, // data starts at row 2
      values: (row as string[]).map((v) => v?.toString() ?? ""),
    }));

    return res.status(200).json({ headers, entries });
  } catch (err) {
    console.error("Error listing QC daily production (admin):", err);
    return res
      .status(500)
      .json({ error: "Failed to load QC daily production entries" });
  }
}
