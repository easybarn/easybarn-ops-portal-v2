import { NextResponse } from "next/server";
import { apiUser, fail } from "@/lib/auth";
import { createSlip } from "@/lib/slips";

// POST { orderKeys: [...], notes? } → new picking slip
export async function POST(request) {
  const { ctx, res } = await apiUser();
  if (res) return res;
  try {
    const b = await request.json();
    const slip = await createSlip(b.orderKeys || [], ctx.user.id, b.notes);
    return NextResponse.json({ slip });
  } catch (e) { return fail(e, 400); }
}
