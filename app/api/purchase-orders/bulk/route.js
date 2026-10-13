import { NextResponse } from "next/server";
import { apiUser, fail } from "@/lib/auth";
import { getOrderByName, enrichOrders } from "@/lib/orders";
import { createPoFromOrder } from "@/lib/purchase-orders";

// POST { orderKeys: ["EASYBARN2117", ...] } → one draft PO (queued) per order
export async function POST(request) {
  const { ctx, res } = await apiUser();
  if (res) return res;
  let keys;
  try { keys = [...new Set((await request.json()).orderKeys || [])].slice(0, 60); } catch { return fail(new Error("Invalid request"), 400); }
  if (!keys.length) return fail(new Error("No orders selected"), 400);
  const results = [];
  for (const key of keys) {
    try {
      const o = await getOrderByName(key);
      if (!o) { results.push({ key, ok: false, error: "Order not found" }); continue; }
      const [order] = await enrichOrders([o]);
      const po = await createPoFromOrder(order, ctx.user.id);
      results.push({ key, ok: true, po_number: po.po_number, id: po.id });
    } catch (e) {
      results.push({ key, ok: false, error: e.message, existing: e.po?.po_number });
    }
  }
  return NextResponse.json({ results, created: results.filter((r) => r.ok).length });
}
