import { NextResponse } from "next/server";
import { apiUser, fail } from "@/lib/auth";
import { getSalesByKeys, enrichSales } from "@/lib/takealot";
import { createPoFromSale } from "@/lib/purchase-orders";

// POST { keys: ["<order_item_id>", ...] } → one draft PO (queued) per Takealot sale
export async function POST(request) {
  const { ctx, res } = await apiUser();
  if (res) return res;
  let keys;
  try { keys = [...new Set(((await request.json()).keys || []).map(String))].slice(0, 60); } catch { return fail(new Error("Invalid request"), 400); }
  if (!keys.length) return fail(new Error("No orders selected"), 400);
  try {
    const sales = await enrichSales(await getSalesByKeys(keys));
    const byKey = new Map(sales.map((s) => [s.key, s]));
    const results = [];
    for (const key of keys) {
      const sale = byKey.get(key);
      if (!sale) { results.push({ key, ok: false, error: "Sale not found in the last 180 days" }); continue; }
      try {
        const po = await createPoFromSale(sale, ctx.user.id);
        results.push({ key, name: sale.name, ok: true, po_number: po.po_number, id: po.id });
      } catch (e) {
        results.push({ key, name: sale.name, ok: false, error: e.message });
      }
    }
    return NextResponse.json({ results, created: results.filter((r) => r.ok).length });
  } catch (e) { return fail(e); }
}
