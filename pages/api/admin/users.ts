import type { NextApiRequest, NextApiResponse } from "next";
import { getAuthFromRequest } from "../../../lib/auth";
import { getSheetsClient } from "../../../lib/googleSheets";
import bcrypt from "bcryptjs";

type UserRow = {
  rowNumber: number; // actual sheet row (A2 is 2, A3 is 3, etc.)
  name: string;
  username: string;
  employeeNumber: string;
  role: string;
};

type ListResponse = { users: UserRow[] } | { error: string };
type MutateResponse = { success: boolean; error?: string };

const SHEET_NAME = "Emb Users";

// Helper: check if current user is admin by looking up role in Emb Users (col E)
async function ensureAdmin(username: string) {
  const { sheets, spreadsheetId } = await getSheetsClient();

  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${SHEET_NAME}!A2:E1000`,
  });

  const rows = resp.data.values || [];

  const row = rows.find((r) => (r[1] || "").trim() === username.trim());
  const role = (row && row[4]) || "";

  if (!role || role.toLowerCase() !== "admin") {
    throw new Error("Forbidden");
  }
}

// GET: list users
// POST: add user
// PUT: update user
// DELETE: deactivate user
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ListResponse | MutateResponse>
) {
  const auth = getAuthFromRequest(req);
  if (!auth) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    await ensureAdmin(auth.username);
  } catch {
    return res.status(403).json({ error: "Forbidden" });
  }

  const { sheets, spreadsheetId } = await getSheetsClient();

  if (req.method === "GET") {
    try {
      const resp = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${SHEET_NAME}!A2:E1000`,
      });

      const rows = resp.data.values || [];

      const users: UserRow[] = rows.map((row, idx) => {
        const name = row[0] || "";
        const username = row[1] || "";
        const employeeNumber = row[3] || "";
        const role = row[4] || "";
        const rowNumber = idx + 2; // because we started at A2

        return {
          rowNumber,
          name,
          username,
          employeeNumber,
          role,
        };
      });

      return res.status(200).json({ users });
    } catch (err) {
      console.error("Admin list users error:", err);
      return res
        .status(500)
        .json({ error: "Failed to load users" });
    }
  }

  if (req.method === "POST") {
    // Add user
    const { name, username, employeeNumber, role, password } = req.body || {};

    if (!name || !username || !employeeNumber || !role || !password) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields",
      });
    }

    try {
      // hash password
      const passwordHash = await bcrypt.hash(password, 10);

      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `${SHEET_NAME}!A2:E2`,
        valueInputOption: "RAW",
        requestBody: {
          values: [[name, username, passwordHash, employeeNumber, role]],
        },
      });

      return res.status(200).json({ success: true });
    } catch (err) {
      console.error("Admin add user error:", err);
      return res
        .status(500)
        .json({ success: false, error: "Failed to add user" });
    }
  }

  if (req.method === "PUT") {
    // Update user (name, employeeNumber, role, optional password)
    const { rowNumber, name, employeeNumber, role, newPassword } =
      req.body || {};

    if (!rowNumber || !name || !employeeNumber || !role) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields",
      });
    }

    try {
      let passwordHash = ""; // keep existing unless newPassword provided

      // Get existing row to keep username and existing password hash if needed
      const rowIndex = Number(rowNumber) - 2; // index in 0-based array
      const resp = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${SHEET_NAME}!A2:E1000`,
      });
      const rows = resp.data.values || [];
      const existing = rows[rowIndex];

      if (!existing) {
        return res
          .status(404)
          .json({ success: false, error: "User row not found" });
      }

      const username = existing[1] || "";
      const currentPasswordHash = existing[2] || "";

      if (newPassword && newPassword.trim().length > 0) {
        passwordHash = await bcrypt.hash(newPassword, 10);
      } else {
        passwordHash = currentPasswordHash;
      }

      // Write back A–E on that row
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${SHEET_NAME}!A${rowNumber}:E${rowNumber}`,
        valueInputOption: "RAW",
        requestBody: {
          values: [[name, username, passwordHash, employeeNumber, role]],
        },
      });

      return res.status(200).json({ success: true });
    } catch (err) {
      console.error("Admin update user error:", err);
      return res
        .status(500)
        .json({ success: false, error: "Failed to update user" });
    }
  }

  if (req.method === "DELETE") {
    // Deactivate user: clear password hash and set role to "Inactive"
    const { rowNumber } = req.query;

    if (!rowNumber) {
      return res.status(400).json({
        success: false,
        error: "Missing rowNumber",
      });
    }

    try {
      const rowNum = Number(rowNumber);
      const rowIndex = rowNum - 2;

      const resp = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${SHEET_NAME}!A2:E1000`,
      });
      const rows = resp.data.values || [];
      const existing = rows[rowIndex];

      if (!existing) {
        return res
          .status(404)
          .json({ success: false, error: "User row not found" });
      }

      const name = existing[0] || "";
      const username = existing[1] || "";
      const employeeNumber = existing[3] || "";

      // Clear passwordHash and mark role as Inactive
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${SHEET_NAME}!A${rowNum}:E${rowNum}`,
        valueInputOption: "RAW",
        requestBody: {
          values: [[name, username, "", employeeNumber, "Inactive"]],
        },
      });

      return res.status(200).json({ success: true });
    } catch (err) {
      console.error("Admin deactivate user error:", err);
      return res
        .status(500)
        .json({ success: false, error: "Failed to deactivate user" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
