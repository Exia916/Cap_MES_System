import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import { getQCDailyEntryById } from "@/lib/repositories/qcRepo";

export async function GET(req: NextRequest) {
  const auth = await getAuthFromRequest(req as any);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = req.nextUrl.searchParams.get("id")?.trim() ?? "";
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const entry = await getQCDailyEntryById(id);
  if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (auth.role !== "ADMIN" && Number(auth.employeeNumber) !== Number(entry.employeeNumber)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({ entry }, { status: 200 });
}
