import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";

type FlatUser = {
  username: string | null;
  displayName: string | null;
  employeeNumber: number | null;
  role: string | null;
  department: string | null;
  userId: string | null;
};

type MeResponse = FlatUser & {
  user: FlatUser | null;
  error?: string;
};

export async function GET(req: NextRequest) {
  const auth = await getAuthFromRequest(req as any);

  if (!auth) {
    return NextResponse.json(
      {
        error: "Not authenticated",
        username: null,
        displayName: null,
        employeeNumber: null,
        role: null,
        department: null,
        userId: null,
        user: null,
      } satisfies MeResponse,
      { status: 401 }
    );
  }

  const payload: FlatUser = {
    username: (auth as any).username ?? null,
    displayName:
      (auth as any).displayName ??
      (auth as any).name ??
      (auth as any).username ??
      null,
    employeeNumber:
      (auth as any).employeeNumber != null
        ? Number((auth as any).employeeNumber)
        : (auth as any).userId != null
          ? Number((auth as any).userId)
          : null,
    role: (auth as any).role ?? null,
    department: (auth as any).department ?? null,
    userId:
      (auth as any).userId != null
        ? String((auth as any).userId)
        : (auth as any).sub != null
          ? String((auth as any).sub)
          : null,
  };

  return NextResponse.json<MeResponse>(
    {
      ...payload,
      user: payload,
    },
    { status: 200 }
  );
}