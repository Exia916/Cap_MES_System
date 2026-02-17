// pages/api/admin/emblem-production-all.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getAuthFromRequest } from "../../../lib/auth";
import { getSheetsClient } from "../../../lib/googleSheets";

const SHEET_ID = process.env.GOOGLE_SHEET_ID as string;

const EMBLEM_SHEET_NAME = "Emblem Production";
const USERS_SHEET_NAME = "Emb Users";

type EmblemRow = {
  rowNumber: number;
  values: string[]; // A..P
};

type SuccessResponse = {
  headers: string[]; // A..P
  entries: EmblemRow[];
};

type ErrorResponse = { error: string };
type ApiResponse = SuccessResponse | ErrorResponse;

// ---- Helpers ----
function findColumnIndex(headers: string[], names: string[]): number | null {
  const lowered = headers.map((h) => (h ?? "").toString().trim().toLowerCase());
  for (const name of names) {
    const idx = lowered.indexOf(name.toLowerCase());
    if (idx !== -1) return idx;
  }
  return null;
}

async function getUserRoles(
  sheets: any,
  auth: { username?: string; displayName?: string }
): Promise<string[]> {
  const username = (auth.username ?? "").toString().trim().toLowerCase();
  const displayName = (auth.displayName ?? "").toString().trim().toLowerCase();

  const headerResp = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${USERS_SHEET_NAME}!A1:Z1`,
  });

  const headerRow = (headerResp.data.values?.[0] || []) as string[];
  const headers = headerRow.map((h) => h?.toString() ?? "");

  const nameCol = findColumnIndex(headers, ["name"]);
  const usernameCol = findColumnIndex(headers, ["username", "user"]);
  const roleCol = findColumnIndex(headers, ["role", "roles"]);
  if (roleCol == null) return [];

  const dataResp = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${USERS_SHEET_NAME}!A2:Z`,
  });

  const rows = dataResp.data.values || [];
  const roles: string[] = [];

  const norm = (v: any) =>
    (v ?? "").toString().trim().replace(/\s+/g, " ").toLowerCase();

  for (const row of rows) {
    const cells = row as string[];

    const nameCell = nameCol != null ? norm(cells[nameCol]) : "";
    const userCell = usernameCol != null ? norm(cells[usernameCol]) : "";

    const matchesUser =
      (username && userCell === username) ||
      (displayName && nameCell === displayName);

    if (!matchesUser) continue;

    const roleCellRaw = (cells[roleCol] ?? "").toString().trim();
    if (!roleCellRaw) break;

    roles.push(
      ...roleCellRaw
        .split(/[;,]/)
        .map((r) => r.trim())
        .filter(Boolean)
    );
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

    const roles = await getUserRoles(sheets, auth);
    const allowed = roles
      .map((r) => r.toLowerCase())
      .some((r) => r === "admin" || r === "supervisor");
    if (!allowed) {
      return res.status(403).json({
        error: "Forbidden: you do not have access to this data",
      });
    }

    // Headers A1:P1
    const headerResp = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${EMBLEM_SHEET_NAME}!A1:P1`,
      valueRenderOption: "FORMATTED_VALUE",
    });

    const headerRow = (headerResp.data.values?.[0] || []) as string[];
    const headers = Array.from({ length: 16 }).map((_, i) =>
      (headerRow[i] ?? "").toString()
    );

    // Data: A..O plus P separately (stable)
    const rangeAO = `${EMBLEM_SHEET_NAME}!A2:O`;
    const rangeP = `${EMBLEM_SHEET_NAME}!P2:P`;

    const dataResp = await sheets.spreadsheets.values.batchGet({
      spreadsheetId: SHEET_ID,
      ranges: [rangeAO, rangeP],
      valueRenderOption: "FORMATTED_VALUE",
    });

    const valueRanges = dataResp.data.valueRanges || [];

    const vrAO =
      valueRanges.find((vr) => (vr.range || "").includes("!A2:O")) || null;
    const vrP =
      valueRanges.find((vr) => (vr.range || "").includes("!P2:P")) || null;

    const rowsAO = ((vrAO?.values as any) || []) as string[][];
    const colP = ((vrP?.values as any) || []) as string[][];

    const maxRows = Math.max(rowsAO.length, colP.length);

    const entries: EmblemRow[] = [];
    for (let i = 0; i < maxRows; i++) {
      const rowNumber = i + 2;

      const ao = (rowsAO[i] || []).map((v) => (v ?? "").toString());
      while (ao.length < 15) ao.push(""); // A..O

      const pVal = (colP[i]?.[0] ?? "").toString();

      entries.push({
        rowNumber,
        values: [...ao, pVal], // P at index 15
      });
    }

    return res.status(200).json({ headers, entries });
  } catch (err) {
    console.error("Error listing Emblem Production (admin):", err);
    return res
      .status(500)
      .json({ error: "Failed to load Emblem Production entries" });
  }
}


