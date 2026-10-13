import { NextResponse } from "next/server";
import { apiUser, fail } from "@/lib/auth";
import { removeOrderFromSlip } from "@/lib/slips";

export async function POST(request, { params }) {
  const { res } = await apiUser();
  if (res) return res;
  const { id } = await params;
  try {
    await removeOrderFromSlip(id, (await request.json()).orderKey);
    return NextResponse.json({ ok: true });
  } catch (e) { return fail(e, 400); }
}
