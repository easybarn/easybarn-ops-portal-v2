import { NextResponse } from "next/server";
import { apiUser, fail } from "@/lib/auth";
import { tickSlip } from "@/lib/slips";

// POST { keys: ["shopify:EASYBARN2117:BF1001", ...], tick: "picked"|"stock_issue"|"packed", value: true|false }
export async function POST(request, { params }) {
  const { ctx, res } = await apiUser();
  if (res) return res;
  const { id } = await params;
  try {
    const b = await request.json();
    const state = await tickSlip(id, b.keys || b.key, b.tick, b.value, ctx.user.email);
    return NextResponse.json({ pick_state: state });
  } catch (e) { return fail(e, 400); }
}
