import { NextResponse } from "next/server";
import { apiUser, fail } from "@/lib/auth";
import { getOrderByName, enrichOrders } from "@/lib/orders";
import { createPoFromOrder } from "@/lib/purchase-orders";

// POST { orderKey: "EASYBARN2117", notes? } → creates a draft PO from the Shopify order
export async function POST(request) {
  const { ctx, res } = await apiUser();
  if (res) return res;
  try {
    const { orderKey, notes } = await request.json();
    const o = await getOrderByName(orderKey);
    if (!o) return fail(new Error("Order not found in Shopify"), 404);
    const [order] = await enrichOrders([o]);
    const po = await createPoFromOrder(order, ctx.user.id, { notes });
    return NextResponse.json({ po });
  } catch (e) {
    if (e.status === 409) return NextResponse.json({ error: e.message, po: e.po }, { status: 409 });
    return fail(e, 400);
  }
}
