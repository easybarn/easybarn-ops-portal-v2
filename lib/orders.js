import "server-only";
import { shopifyGraphQL } from "@/lib/shopify";
import { createClient } from "@/lib/supabase-server";
import { resolveSkus } from "@/lib/sku-resolve";
import { orderPicked } from "@/lib/slips";
import { stageOf } from "@/lib/pipeline";

const ORDER_FIELDS = `
  id name createdAt cancelledAt displayFinancialStatus displayFulfillmentStatus note tags email phone
  currentTotalPriceSet { shopMoney { amount } }
  totalShippingPriceSet { shopMoney { amount } }
  customer { firstName lastName email phone }
  shippingAddress { name company address1 address2 city province provinceCode zip country phone latitude longitude }
  shippingLines(first: 3) { nodes { title } }
  lineItems(first: 50) {
    nodes { id title quantity currentQuantity sku variantTitle customAttributes { key value } variant { sku } originalUnitPriceSet { shopMoney { amount } } discountedUnitPriceAfterAllDiscountsSet { shopMoney { amount } } }
  }
  fulfillments(first: 10) { id status createdAt trackingInfo { number url company } }
`;

export const TABS = {
  toship: { label: "To ship", query: "(fulfillment_status:unfulfilled OR fulfillment_status:partial) AND financial_status:paid AND status:open" },
  pending: { label: "Awaiting payment", query: "fulfillment_status:unfulfilled AND (financial_status:pending OR financial_status:partially_paid) AND status:open" },
  shipped: { label: "Shipped", query: "fulfillment_status:shipped" },
};

export function mapOrder(o) {
  const c = o.customer || {};
  const s = o.shippingAddress || null;
  const items = (o.lineItems?.nodes || []).map((l) => ({
    id: l.id,
    title: l.title,
    variant: l.variantTitle && l.variantTitle !== "Default Title" ? l.variantTitle : "",
    qty: l.currentQuantity ?? l.quantity,
    sku: (l.variant && l.variant.sku) || l.sku || "",
    props: (l.customAttributes || []).filter((a) => a.value && !a.key.startsWith("_")),
    price: Number((l.discountedUnitPriceAfterAllDiscountsSet || l.originalUnitPriceSet)?.shopMoney?.amount || 0),
    listPrice: Number(l.originalUnitPriceSet?.shopMoney?.amount || 0),
  })).filter((l) => l.qty > 0 && !(!l.sku && /^(delivery|shipping|courier)( fee| charge)?$/i.test(l.title.trim())));
  const tracking = (o.fulfillments || []).flatMap((f) => (f.trackingInfo || []).map((t) => ({ ...t, status: f.status, at: f.createdAt })));
  return {
    id: o.id,
    name: o.name,
    key: o.name.replace(/^#/, ""),
    createdAt: o.createdAt,
    ageDays: (Date.now() - new Date(o.createdAt).getTime()) / 864e5,
    cancelled: !!o.cancelledAt,
    financial: o.displayFinancialStatus,
    fulfillment: o.displayFulfillmentStatus,
    note: o.note || "",
    tags: o.tags || [],
    total: Number(o.currentTotalPriceSet?.shopMoney?.amount || 0),
    shippingCharged: Number(o.totalShippingPriceSet?.shopMoney?.amount || 0),
    shippingMethod: o.shippingLines?.nodes?.[0]?.title || "",
    customer: {
      name: `${c.firstName || ""} ${c.lastName || ""}`.trim() || s?.name || "—",
      email: c.email || o.email || "",
      phone: s?.phone || c.phone || o.phone || "",
    },
    address: s,
    items,
    tracking,
  };
}

export async function listOrders(tab = "toship", { q = "", after = null } = {}) {
  const t = TABS[tab] || TABS.toship;
  const query = q.trim() ? `${t.query} AND (${q.trim().replace(/[()]/g, "")})` : t.query;
  const data = await shopifyGraphQL(
    `query Orders($q: String!, $after: String) {
      orders(first: 50, after: $after, query: $q, sortKey: CREATED_AT, reverse: true) {
        pageInfo { hasNextPage endCursor }
        nodes { ${ORDER_FIELDS} }
      }
    }`,
    { q: query, after }
  );
  return { orders: data.orders.nodes.map(mapOrder), next: data.orders.pageInfo.hasNextPage ? data.orders.pageInfo.endCursor : null };
}

export async function getOrderByName(key) {
  const name = "#" + String(key).replace(/^#/, "").trim();
  const q = `query Find($q: String!, $n: Int!) { orders(first: $n, query: $q, sortKey: CREATED_AT, reverse: true) { nodes { ${ORDER_FIELDS} } } }`;
  const exact = (nodes) => nodes.find((o) => o.name.toUpperCase() === name.toUpperCase());
  // Shopify's name search is fuzzy, so ask for several matches and pick the exact one
  for (const term of [`name:"${name}"`, `name:${name.slice(1)}`]) {
    const d = await shopifyGraphQL(q, { q: term, n: 10 });
    const o = exact(d.orders.nodes);
    if (o) return mapOrder(o);
  }
  // Brand-new orders can take a moment to reach the search index: scan the latest orders directly
  const d = await shopifyGraphQL(q, { q: "", n: 100 });
  const o = exact(d.orders.nodes);
  return o ? mapOrder(o) : null;
}

export async function getOrderById(id) {
  const data = await shopifyGraphQL(`query One($id: ID!) { order(id: $id) { ${ORDER_FIELDS} } }`, { id });
  return data.order ? mapOrder(data.order) : null;
}

// Add P&P product info to each line, and slip / PO status to each order
export async function enrichOrders(orders) {
  const resolved = await resolveSkus(orders.flatMap((o) => o.items.map((i) => ({ marketplace: "shopify", sku: i.sku }))));
  const supabase = await createClient();
  const keys = orders.map((o) => o.key);

  const poMap = {}, slipMap = {};
  try {
    const { data: pos } = await supabase.from("purchase_orders").select("id, po_number, status, source_order_id")
      .eq("source_marketplace", "shopify").in("source_order_id", keys).neq("status", "cancelled");
    for (const p of pos || []) poMap[p.source_order_id] = p;
  } catch {}
  try {
    const { data: slips } = await supabase.from("picking_slips").select("id, slip_number, status, order_refs, pick_state, created_at")
      .neq("status", "cancelled").order("created_at", { ascending: false }).limit(300);
    const want = new Set(keys);
    for (const s of slips || []) {
      for (const r of s.order_refs || []) {
        const k = String(r.order_id);
        if (r.marketplace !== "shopify" || !want.has(k)) continue;
        const ex = slipMap[k];
        if (!ex || (ex.status === "complete" && s.status !== "complete")) slipMap[k] = { id: s.id, number: s.slip_number, status: s.status, pick_state: s.pick_state };
      }
    }
  } catch {}

  return orders.map((o) => {
    const raw = slipMap[o.key];
    const slip = raw ? { id: raw.id, number: raw.number, status: raw.status, picked: orderPicked(raw, o) } : null;
    const out = {
      ...o,
      items: o.items.map((i) => {
        const p = i.sku ? resolved.get(`shopify:${i.sku}`) : null;
        return { ...i, product: p ? { code: p.warehouse_code, description: p.description, size: p.size, cost: p.cost_excl_vat, freeIssue: p.free_issue } : null };
      }),
      po: poMap[o.key] || null,
      slip,
    };
    out.stage = stageOf(out);
    return out;
  });
}

// Every order on a tab (up to ~300), all pages
export async function listAllOrders(tab = "toship") {
  let orders = [], after = null;
  for (let page = 0; page < 6; page++) {
    const r = await listOrders(tab, { after });
    orders = orders.concat(r.orders);
    if (!r.next) break;
    after = r.next;
  }
  return orders;
}

// Several orders by name in one Shopify call ("EASYBARN2117", ...)
export async function getOrdersByNames(keys) {
  const names = [...new Set(keys.map((k) => "#" + String(k).replace(/^#/, "")))];
  if (!names.length) return [];
  const found = new Map();
  for (let i = 0; i < names.length; i += 25) {
    const chunk = names.slice(i, i + 25);
    const d = await shopifyGraphQL(
      `query Many($q: String!, $n: Int!) { orders(first: $n, query: $q) { nodes { ${ORDER_FIELDS} } } }`,
      { q: chunk.map((n) => `name:"${n}"`).join(" OR "), n: Math.min(250, chunk.length * 4) }
    );
    for (const o of d.orders.nodes) if (chunk.includes(o.name)) found.set(o.name, mapOrder(o));
  }
  const missing = names.filter((n) => !found.has(n));
  for (const n of missing) { const o = await getOrderByName(n); if (o) found.set(n, o); }
  return names.map((n) => found.get(n)).filter(Boolean);
}
