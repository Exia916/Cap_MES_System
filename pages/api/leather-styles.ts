// pages/api/leather-styles.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getSheetsClient } from "../../lib/googleSheets";

const SHEET_ID = process.env.GOOGLE_SHEET_ID as string;
const LEATHER_SHEET_NAME = "Leather Styles";

type StylesResponse =
  | { styles: string[] }
  | { error: string };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<StylesResponse>
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { sheets } = await getSheetsClient();

    const range = `${LEATHER_SHEET_NAME}!A2:A`;
    const resp = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range,
    });

    const rows = resp.data.values || [];
    const styles = rows
      .map((r) => (r[0] ?? "").toString().trim())
      .filter((v) => v.length > 0);

    return res.status(200).json({ styles });
  } catch (err) {
    console.error("Error loading leather styles:", err);
    return res
      .status(500)
      .json({ error: "Failed to load leather styles" });
  }
}
