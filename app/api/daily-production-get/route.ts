import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import { getEmbroideryEntryById } from "@/lib/repositories/embroideryRepo";

type Resp = { entry: any } | { error: string };

export async function GET(req: NextRequest) {
  const auth = getAuthFromRequest(req);
  if (!auth) return NextResponse.json<Resp>({ error: "Unauthorized" }, { status: 401 });

  const id = req.nextUrl.searchParams.get("id")?.trim() ?? "";
  if (!id) return NextResponse.json<Resp>({ error: "Missing id" }, { status: 400 });

  try {
    const entry = await getEmbroideryEntryById(id);
    if (!entry) return NextResponse.json<Resp>({ error: "Not found" }, { status: 404 });

    // Non-admin can only read their own entries
    if (auth.role !== "ADMIN" && Number(auth.employeeNumber) !== Number(entry.employeeNumber)) {
      return NextResponse.json<Resp>({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json<Resp>({ entry }, { status: 200 });
  } catch (err) {
    console.error("daily-production-get GET error:", err);
    return NextResponse.json<Resp>({ error: "Server error" }, { status: 500 });
  }
}
