import "server-only";
import { createClient } from "@/lib/supabase-server";
import { resolveSkus } from "@/lib/sku-resolve";

// Takealot uses two APIs with the same key:
//   seller-api.takealot.com/v2      "Authorization: Key …"  → /sales (lead-time orders)
//   marketplace-api.takealot.com/v1 "X-API-Key: …"          → /shipments, /offers, /seller
const SELLER = "https://seller-api.takealot.com";
const MARKET = "https://marketplace-api.takealot.com/v1";

function key() {
  const k = process.env.TAKEALOT_API_KEY;
  if (!k) throw new Error("TAKEALOT_API_KEY is not set");
  return k;
}

async function get(url, headers) {
  const res = await fetch(url, { headers: { ...headers, Accept: "application/json" }, cache: "no-store" });
  if (!res.ok) throw new Error(`Takealot ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res.json();
}
const seller = (path) => get(`${SELLER}${path}`, { Authorization: `Key ${key()}` });
const market = (path) => get(`${MARKET}${path}`, { "X-API-Key": key() });

// "13 Oct 2026 10:22:11" or ISO → Date
export function parseTalDate(s) {
  if (!s) return null;
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d;
  const m = String(s).match(/(\d{1,2}) (\w{3})\w* (\d{4})(?: (\d{1,2}):(\d{2}):?(\d{2})?)?/);
  if (!m) return null;
  const mon = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 }[m[2]];
  return mon == null ? null : new Date(+m[3], mon, +m[1], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0));
}

// ---- Sales (lead-time orders) ----

// Stage of a sale in our process
//   todo     — not yet in a Takealot shipment (needs PO + to be added to a shipment)
//   shipment — in a shipment, not yet received / shipped to customer
//   done     — shipped to / delivered to customer
//   cancelled
export function saleStage(s) {
  const st = String(s.status || "").toLowerCase();
  if (st.includes("cancel") || st.includes("return")) return "cancelled";
  if (st.includes("shipped to customer") || st.includes("delivered") || st.includes("collected")) return "done";
  if (s.shipmentId || st.includes("preparing") || st.includes("inter dc") || st.includes("shipped")) return "shipment";
  return "todo";
}

function mapSale(s) {
  const created = parseTalDate(s.order_date);
  const out = {
    key: String(s.order_item_id),
    orderItemId: s.order_item_id,
    orderId: s.order_id,
    name: `TAL ${s.order_id}`,
    createdAt: created ? created.toISOString() : null,
    ageDays: created ? (Date.now() - created.getTime()) / 864e5 : 0,
    sku: s.sku || "",
    title: s.product_title || "",
    qty: Number(s.quantity) || 1,
    total: Number(s.selling_price || 0), // selling_price is already the line total
    status: s.sale_status || "",
    customer: s.customer || "—",
    dc: s.dc || s.customer_dc || "",
    shipmentId: s.shipment_id || null,
    shipmentName: s.shipment_name || null,
    poNumber: s.po_number || null,
    url: s.takealot_url || s.takealot_url_mobi || "",
    fees: Number(s.total_fee || 0),
  };
  out.stage = saleStage(out);
  return out;
}

export async function listSales(days = 60) {
  const since = new Date(Date.now() - days * 864e5).toISOString().slice(0, 10);
  let all = [], token = null;
  for (let page = 0; page < 20; page++) {
    const qs = new URLSearchParams({ order_date__gte: since, limit: "100", ...(token ? { continuation_token: token } : {}) });
    const d = await seller(`/v2/sales?${qs}`);
    const rows = d.sales || d.items || [];
    all = all.concat(rows);
    token = d.continuation_token || d.page_summary?.continuation_token || null;
    if (!token || !rows.length) break;
  }
  return all.map(mapSale).sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
}

// Add P&P product + PO to each sale
export async function enrichSales(sales) {
  const resolved = await resolveSkus(sales.map((s) => ({ marketplace: "takealot", sku: s.sku })));
  const supabase = await createClient();
  const poMap = {};
  const keys = sales.map((s) => s.key);
  for (let i = 0; i < keys.length; i += 200) {
    const { data } = await supabase.from("purchase_orders").select("id, po_number, status, source_order_id")
      .eq("source_marketplace", "takealot").in("source_order_id", keys.slice(i, i + 200)).neq("status", "cancelled");
    for (const p of data || []) poMap[p.source_order_id] = p;
  }
  return sales.map((s) => {
    const p = s.sku ? resolved.get(`takealot:${s.sku}`) : null;
    return {
      ...s,
      product: p ? { code: p.warehouse_code, description: p.description, size: p.size, cost: p.cost_excl_vat, freeIssue: p.free_issue } : null,
      po: poMap[s.key] || null,
    };
  });
}

export async function getSalesByKeys(keys, days = 180) {
  const want = new Set(keys.map(String));
  return (await listSales(days)).filter((s) => want.has(s.key));
}

// ---- Shipments ----

const DC_BY_FACILITY = { 1: "CPT", 3: "JHB", 6: "DBN" };
export const dcOf = (s) => String(s.destination_region || "").toUpperCase() || DC_BY_FACILITY[s.destination_facility_id] || "";

export function shipmentState(s) {
  if (s.cancelled) return "cancelled";
  if (s.shipped) return "shipped";
  if (s.archived) return "archived";
  return String(s.purchase_order_state || "draft").toLowerCase();
}

export async function listShipments({ shipped } = {}) {
  const qs = new URLSearchParams({ limit: "100", order_by: "-shipment_id" });
  if (shipped != null) qs.set("shipped", String(shipped));
  const d = await market(`/shipments?${qs}`);
  return (d.items || d.shipments || []).map((s) => ({
    id: s.shipment_id,
    reference: s.reference,
    poNumber: s.purchase_order_number,
    dueDate: s.due_date,
    createdAt: s.created_at,
    dc: dcOf(s),
    state: shipmentState(s),
    shipped: !!s.shipped,
    tracking: s.tracking_info || "",
    type: s.shipment_type || "",
  }));
}

export const getShipment = (id, expands = "shipment_items") => market(`/shipments/${encodeURIComponent(id)}${expands ? `?expands=${encodeURIComponent(expands)}` : ""}`);

export async function getOffers(ids) {
  const out = {};
  await Promise.all([...new Set(ids)].map(async (id) => {
    try { out[id] = await market(`/offers/${encodeURIComponent(id)}`); } catch { out[id] = null; }
  }));
  return out;
}

// Shipment with each item's offer (title, SKU, barcode) and P&P product
export async function loadShipment(id) {
  const s = await getShipment(id);
  const items = (s.shipment_items || []).filter((i) => !i.cancelled);
  const offers = await getOffers(items.map((i) => i.offer_id));
  const resolved = await resolveSkus(Object.values(offers).filter(Boolean).map((o) => ({ marketplace: "takealot", sku: o.sku })));
  return {
    raw: s,
    id: s.shipment_id,
    reference: s.reference,
    poNumber: s.purchase_order_number,
    dueDate: s.due_date,
    dc: dcOf(s),
    state: shipmentState(s),
    tracking: s.tracking_info || "",
    items: items.map((i) => {
      const o = offers[i.offer_id];
      const p = o?.sku ? resolved.get(`takealot:${o.sku}`) : null;
      return {
        id: i.shipment_item_id,
        offerId: i.offer_id,
        title: o?.title || `Offer ${i.offer_id}`,
        sku: o?.sku || "",
        tsin: o?.tsin_id || "",
        barcode: o?.product_label || o?.barcode || "",
        sending: i.quantity_sending || 0,
        received: i.purchase_order_quantity_received ?? null,
        damaged: i.purchase_order_quantity_damaged ?? null,
        product: p ? { code: p.warehouse_code, description: p.description, size: p.size } : null,
      };
    }),
  };
}

// Shape the PDF generators expect
export const pdfShipment = (s) => ({
  name: s.reference,
  po_number: s.poNumber,
  due_date: { date: s.dueDate, timestamp: s.dueDate ? new Date(s.dueDate).getTime() / 1000 : 0 },
});
