import { NextResponse } from "next/server";
import { apiUser, fail } from "@/lib/auth";
import { setSlipStatus } from "@/lib/slips";

// PATCH { status?, notes? }
export async function PATCH(request, { params }) {
  const { res } = await apiUser();
  if (res) return res;
  const { id } = await params;
  try {
    const b = await request.json();
    await setSlipStatus(id, b.status, b.notes);
    return NextResponse.json({ ok: true });
  } catch (e) { return fail(e, 400); }
}
