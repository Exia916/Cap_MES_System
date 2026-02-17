import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";

type MeResponse = {
  username?: string;
  displayName?: string;
  employeeNumber?: string;
  error?: string;
};

export async function GET(req: NextRequest) {
  const auth = getAuthFromRequest(req);
  if (!auth) {
    return NextResponse.json<MeResponse>({ error: "Not authenticated" }, { status: 401 });
  }

  return NextResponse.json<MeResponse>(
    {
      username: auth.username,
      displayName: auth.displayName,
      employeeNumber: auth.userId,
    },
    { status: 200 }
  );
}
