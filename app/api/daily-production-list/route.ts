import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import {
  listEmbroideryEntriesByShiftDate,
  listEmbroideryEntriesByUserAndShiftDate,
} from "@/lib/repositories/embroideryRepo";

type ListResponse =
  | { entries: any[] }
  | { error: string };

function isValidShiftDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export async function GET(req: NextRequest) {
  const auth = getAuthFromRequest(req);

  if (!auth) {
    return NextResponse.json<ListResponse>(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const shiftDate =
    req.nextUrl.searchParams.get("shiftDate")?.trim() ?? "";

  if (!isValidShiftDate(shiftDate)) {
    return NextResponse.json<ListResponse>(
      { error: "Missing or invalid shiftDate (expected YYYY-MM-DD)" },
      { status: 400 }
    );
  }

  try {
    let entries;

    if (auth.role === "ADMIN") {
      // ✅ Admin sees all
      entries = await listEmbroideryEntriesByShiftDate(shiftDate);
    } else {
      // ✅ Others see only their own
      entries = await listEmbroideryEntriesByUserAndShiftDate(
        Number(auth.employeeNumber),
        shiftDate
      );
    }

    return NextResponse.json<ListResponse>(
      { entries },
      { status: 200 }
    );
  } catch (err) {
    console.error("daily-production-list GET error:", err);

    return NextResponse.json<ListResponse>(
      { error: "Server error" },
      { status: 500 }
    );
  }
}


