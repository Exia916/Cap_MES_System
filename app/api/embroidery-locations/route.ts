import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import { db } from "@/lib/db";

type LocationRow = {
  location: string;
};

type LocationOption = {
  value: string; // will be the LOCATION TEXT, e.g. "RS"
  label: string; // what the UI displays
};

type Resp = { options: LocationOption[] } | { error: string };

export async function GET(req: NextRequest) {
  const auth = getAuthFromRequest(req);
  if (!auth) return NextResponse.json<Resp>({ error: "Unauthorized" }, { status: 401 });

  try {
    /**
     * IMPORTANT:
     * Your FK is:
     * FOREIGN KEY (embroidery_location) REFERENCES emb_type_locations(location)
     *
     * So the UI must submit the TEXT code (location), not the UUID id.
     */

    // If you want to restrict to Embroidery only AND your table has emb_type, keep the condition.
    // If not, remove that line.
    const result = await db.query<LocationRow>(`
      SELECT DISTINCT location
      FROM emb_type_locations
      WHERE COALESCE(is_active, true) = true
        AND (
          -- keep this if emb_type exists; harmless if it does, but will error if it doesn't
          -- if you are unsure, comment this line out
          emb_type IS NULL OR emb_type ILIKE 'emb%'
        )
      ORDER BY location ASC
    `);

    const options: LocationOption[] = result.rows
      .map((r) => (r.location ?? "").trim())
      .filter(Boolean)
      .map((loc) => ({ value: loc, label: loc }));

    return NextResponse.json<Resp>({ options }, { status: 200 });
  } catch (err) {
    console.error("embroidery-locations GET error:", err);

    // Fallback query if the emb_type filter causes issues in your schema
    try {
      const result = await db.query<LocationRow>(`
        SELECT DISTINCT location
        FROM emb_type_locations
        WHERE COALESCE(is_active, true) = true
        ORDER BY location ASC
      `);

      const options: LocationOption[] = result.rows
        .map((r) => (r.location ?? "").trim())
        .filter(Boolean)
        .map((loc) => ({ value: loc, label: loc }));

      return NextResponse.json<Resp>({ options }, { status: 200 });
    } catch (err2) {
      console.error("embroidery-locations GET fallback error:", err2);
      return NextResponse.json<Resp>({ error: "Server error" }, { status: 500 });
    }
  }
}

