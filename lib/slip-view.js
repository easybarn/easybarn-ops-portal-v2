import "server-only";
import { getSlipRow, lineKeyOf, orderKeyOf, orderPicked } from "@/lib/slips";
import { getOrdersByNames, enrichOrders } from "@/lib/orders";

// Slip + its Shopify orders, with per-line pick keys and a roll-up by P&P code
export async function loadSlip(id) {
  const slip = await getSlipRow(id);
  if (!slip) return null;
  const keys = (slip.order_refs || []).filter((r) => r.marketplace === "shopify").map((r) => String(r.order_id));
  const others = (slip.order_refs || []).filter((r) => r.marketplace !== "shopify");
  const orders = keys.length ? await enrichOrders(await getOrdersByNames(keys)) : [];
  const st = slip.pick_state || {};
  const found = new Set(orders.map((o) => o.key));

  const lines = [];
  const view = orders.map((o) => {
    const items = o.items.map((i, idx) => {
      const key = lineKeyOf(o.key, i, idx);
      const line = { ...i, key, picked: !!st[key]?.picked, stockIssue: !!st[key]?.stock_issue, pickedBy: st[key]?.picked_by || null, order: o.name, orderKey: o.key };
      lines.push(line);
      return line;
    });
    return { ...o, items, orderTick: st[orderKeyOf(o.key)] || {}, allPicked: orderPicked(slip, o) };
  });

  const byCode = new Map();
  for (const l of lines) {
    const code = l.product?.code || (l.sku ? `? ${l.sku}` : "PURPOSE MADE");
    const g = byCode.get(code) || { code, mapped: !!l.product, description: l.product?.description || l.title, size: l.product?.size || "", qty: 0, keys: [], picked: 0, orders: [] };
    g.qty += l.qty;
    g.keys.push(l.key);
    if (l.picked) g.picked++;
    g.orders.push(l.qty > 1 ? `${l.order} ×${l.qty}` : l.order);
    byCode.set(code, g);
  }
  const pickList = [...byCode.values()].sort((a, b) => (a.code === "PURPOSE MADE") - (b.code === "PURPOSE MADE") || a.code.localeCompare(b.code, "en", { numeric: true }));
  const done = lines.filter((l) => l.picked).length;
  return {
    slip,
    orders: view,
    missing: keys.filter((k) => !found.has(k)),
    otherMarketplace: others,
    pickList,
    progress: { done, total: lines.length, issues: lines.filter((l) => l.stockIssue).length },
  };
}
