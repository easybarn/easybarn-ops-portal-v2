import { NextResponse } from "next/server";
import { apiUser, fail } from "@/lib/auth";
import { getLmOrder, enrichLmOrders } from "@/lib/leroymerlin";
import { createPoFromLmOrder } from "@/lib/purchase-orders";

// POST { key: "<LM order id>" } → draft PO (queued) to Panel & Pane
export async function POST(request) {
  const { ctx, res } = await apiUser();
  if (res) return res;
  try {
    const { key } = await request.json();
    const o = await getLmOrder(String(key || ""));
    if (!o) return fail(new Error("Leroy Merlin order not found"), 404);
    const [order] = await enrichLmOrders([o]);
    const po = await createPoFromLmOrder(order, ctx.user.id);
    return NextResponse.json({ ok: true, po_number: po.po_number, id: po.id });
  } catch (e) { return fail(e, e.status || 500); }
}
