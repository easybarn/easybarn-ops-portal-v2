import "server-only";
import { createPoFromOrder } from "@/lib/purchase-orders";

// New paid orders get a draft PO (Doors Delivered → P&P) automatically.
// Only orders placed on/after AUTO_PO_SINCE (default: go-live date) so the old backlog isn't touched.
const SINCE = new Date(process.env.AUTO_PO_SINCE || "2026-10-13T00:00:00+02:00");
const inFlight = new Set();

export async function autoRaisePos(orders, userId) {
  if (process.env.AUTO_PO === "off") return [];
  const created = [];
  for (const o of orders) {
    if (o.stage !== "new" || o.cancelled || o.financial !== "PAID" || new Date(o.createdAt) < SINCE || !o.items.length || inFlight.has(o.key)) continue;
    inFlight.add(o.key);
    try {
      const po = await createPoFromOrder(o, userId, { notes: null });
      o.po = { id: po.id, po_number: po.po_number, status: po.status };
      o.stage = "pick";
      o.autoPo = true;
      created.push(po.po_number);
    } catch (e) {
      if (e.po) { o.po = e.po; o.stage = "pick"; }
    } finally {
      inFlight.delete(o.key);
    }
  }
  return created;
}
