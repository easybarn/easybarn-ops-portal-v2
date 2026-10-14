import "server-only";
import { createClient } from "@/lib/supabase-server";
import { resolveSkus } from "@/lib/sku-resolve";

// Leroy Merlin South Africa runs on Mirakl. Same key and base URL as the old portal.
const BASE = process.env.LEROYMERLIN_BASE_URL || "https://leroymerlinza-prod.mirakl.net";
export const LM_PORTAL = `${BASE}/mmp/shop/order/all`;

// Orders stuck on LM's side that should never show
const EXCLUDED = new Set(["000662974-A"]);

export const LM_STATES = {
  STAGING: "Staging",
  WAITING_ACCEPTANCE: "Pending acceptance",
  WAITING_DEBIT: "Awaiting payment",
  WAITING_DEBIT_PAYMENT: "Awaiting payment",
  SHIPPING: "Awaiting shipment",
  SHIPPED: "Shipped",
  TO_COLLECT: "To collect",
  RECEIVED: "Received",
  CLOSED: "Closed",
  REFUSED: "Rejected",
  CANCELED: "Cancelled",
  REFUNDED: "Refunded",
};

// Tabs as in the old portal
export const LM_TABS = {
  action: { label: "Needs action", states: ["WAITING_ACCEPTANCE", "SHIPPING"] },
  shipped: { label: "Shipped", states: ["SHIPPED", "TO_COLLECT"] },
  done: { label: "Done", states: ["RECEIVED", "CLOSED"] },
  cancelled: { label: "Cancelled", states: ["REFUSED", "CANCELED", "REFUNDED"] },
};
export const CAN_SHIP = ["SHIPPING"];

async function mirakl(path, options = {}) {
  const key = process.env.LEROYMERLIN_API_KEY;
  if (!key) throw new Error("LEROYMERLIN_API_KEY is not set");
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: { Authorization: key, Accept: "application/json", "Content-Type": "application/json", ...(options.headers || {}) },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Leroy Merlin ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const t = await res.text();
  return t ? JSON.parse(t) : {};
}

function mapOrder(m) {
  const c = m.customer || {};
  const bill = c.billing_address || {};
  const ship = c.shipping_address || {};
  const name = (a) => `${a.firstname || ""} ${a.lastname || ""}`.trim();
  return {
    id: m.order_id,
    key: m.order_id,
    name: `LM ${m.order_id}`,
    createdAt: m.created_date,
    state: m.order_state,
    status: LM_STATES[m.order_state] || m.order_state,
    customer: { name: name(bill) || name(ship) || "Customer", phone: ship.phone || bill.phone || "", email: c.customer_email || "" },
    // Same keys as a Shopify address so the ship dialog can use it
    address: ship.city || ship.street_1 ? {
      name: name(ship), company: ship.company || "", address1: ship.street_1 || "", address2: ship.street_2 || "",
      city: ship.city || "", province: ship.state || ship.zone || "", provinceCode: ship.state || "", zip: ship.zip_code || "", country: "South Africa", phone: ship.phone || bill.phone || "",
    } : null,
    items: (m.order_lines || []).map((l) => ({
      id: l.order_line_id,
      sku: l.product_shop_sku || l.offer_sku || l.product_sku || "",
      title: l.product_title || l.offer_name || "",
      variant: "",
      qty: Number(l.quantity) || 1,
      price: Number(l.price || 0),
      state: l.order_line_state,
    })),
    total: Number(m.total_price || 0),
    commission: Number(m.total_commission || 0),
    shipBy: m.shipping_deadline || null,
    deliveryDate: m.delivery_date || null,
    tracking: m.shipping_tracking ? [{ number: m.shipping_tracking, url: m.shipping_tracking_url || "" }] : [],
    url: `${BASE}/mmp/shop/order/${encodeURIComponent(m.order_id)}`,
  };
}

export async function listLmOrders(days = 90) {
  const start = new Date(Date.now() - days * 864e5).toISOString();
  // paginate=false returns every order since start_date in one call (as the old portal did)
  const d = await mirakl(`/api/orders?${new URLSearchParams({ start_date: start, paginate: "false" })}`);
  return (d.orders || []).filter((m) => !EXCLUDED.has(m.order_id)).map(mapOrder).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

// The /api/orders/{id} path returns 410 on Mirakl; filter the list instead
export async function getLmOrder(id) {
  const d = await mirakl(`/api/orders?order_ids=${encodeURIComponent(id)}&max=1&paginate=false`);
  return d.orders?.[0] ? mapOrder(d.orders[0]) : null;
}

export async function enrichLmOrders(orders) {
  const resolved = await resolveSkus(orders.flatMap((o) => o.items.map((i) => ({ marketplace: "leroymerlin", sku: i.sku }))));
  const supabase = await createClient();
  const poMap = {};
  const keys = orders.map((o) => o.key);
  for (let i = 0; i < keys.length; i += 200) {
    const { data } = await supabase.from("purchase_orders").select("id, po_number, status, source_order_id")
      .eq("source_marketplace", "leroymerlin").in("source_order_id", keys.slice(i, i + 200)).neq("status", "cancelled");
    for (const p of data || []) poMap[p.source_order_id] = p;
  }
  return orders.map((o) => ({
    ...o,
    items: o.items.map((i) => {
      const p = i.sku ? resolved.get(`leroymerlin:${i.sku}`) : null;
      return { ...i, product: p ? { code: p.warehouse_code, description: p.description, size: p.size, cost: p.cost_excl_vat, freeIssue: p.free_issue } : null };
    }),
    po: poMap[o.key] || null,
  }));
}

// After booking The Courier Guy: tracking to LM, then mark shipped (same carrier codes as the old portal)
export function lmSetTracking(id, ref, url) {
  return mirakl(`/api/orders/${encodeURIComponent(id)}/tracking`, {
    method: "PUT",
    body: JSON.stringify({ carrier_code: "the courier guy", carrier_name: "The Courier Guy", carrier_standard_code: "the-courier-guy", tracking_number: ref, tracking_url: url }),
  });
}
export const lmMarkShipped = (id) => mirakl(`/api/orders/${encodeURIComponent(id)}/ship`, { method: "PUT" });

// Accept every line still waiting for acceptance (Mirakl OR21)
export async function lmAccept(order) {
  const lines = order.items.filter((i) => i.state === "WAITING_ACCEPTANCE").map((i) => ({ id: i.id, accepted: true }));
  if (!lines.length) throw new Error(`${order.name} has no lines waiting for acceptance`);
  await mirakl(`/api/orders/${encodeURIComponent(order.id)}/accept`, { method: "PUT", body: JSON.stringify({ order_lines: lines }) });
  return lines.length;
}
