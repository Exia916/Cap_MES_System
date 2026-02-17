import type { NextApiRequest, NextApiResponse } from "next";
import { getSheetsClient } from "../../lib/googleSheets";
import { getAuthFromRequest } from "../../lib/auth";

type OptionsResponse = {
  users: {
    name: string;
    username: string;
    employeeNumber: string;
  }[];
  locations: string[];
  error?: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<OptionsResponse>
) {
  // Require login
  const auth = getAuthFromRequest(req);
  if (!auth) {
    return res.status(401).json({ users: [], locations: [], error: "Not authenticated" });
  }

  try {
    const { sheets, spreadsheetId } = await getSheetsClient();

    // Emb Users: A = Name, B = Username, D = Employee Number (adjust if different)
    const [usersResp, locationsResp] = await Promise.all([
      sheets.spreadsheets.values.get({
        spreadsheetId,
        range: "Emb Users!A2:E",
      }),
      sheets.spreadsheets.values.get({
        spreadsheetId,
        range: "Emb Locations!A2:B",
      }),
    ]);

    const users =
      usersResp.data.values?.map((row) => ({
        name: row[0] ?? "",
        username: row[1] ?? "",
        employeeNumber: row[3] ?? "",
      })) ?? [];

    // Use column A from Emb Locations for the dropdown
    const locations =
      locationsResp.data.values?.map((row) => row[0] ?? "").filter((v) => v) ?? [];

    return res.status(200).json({ users, locations });
  } catch (err) {
    console.error("Error loading options:", err);
    return res
      .status(500)
      .json({ users: [], locations: [], error: "Failed to load options" });
  }
}
