import { NextResponse } from "next/server";
import { apiUser, fail } from "@/lib/auth";
import { addOrdersToSlip } from "@/lib/slips";

export async function POST(request, { params }) {
  const { res } = await apiUser();
  if (res) return res;
  const { id } = await params;
  try {
    const slip = await addOrdersToSlip(id, (await request.json()).orderKeys || []);
    return NextResponse.json({ slip });
  } catch (e) { return fail(e, 400); }
}
