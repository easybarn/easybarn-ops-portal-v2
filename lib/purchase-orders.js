import "server-only";
import { createClient } from "@/lib/supabase-server";
import { VAT } from "@/lib/format";

// Purchase orders: Doors Delivered (Pty) Ltd (Easy Barn's holding company) → Panel & Pane Joinery.
// Same tables as the old portal: purchase_orders, purchase_order_lines, po_email_log.

export const BUYER = {
  name: "Doors Delivered (Pty) Ltd",
  tradingAs: "t/a Easy Barn & Bifold Doors",
  email: "hello@easybarn.co.za",
  web: "easybarn.co.za",
};
export const SUPPLIER = {
  name: "Panel & Pane Joinery",
  lines: ["15 JB McIntosh Drive", "Shongweni, Durban 3680"],
  email: "admin@panelandpane.co.za",
};
export const STATUSES = ["draft", "sent", "complete", "cancelled"];

const r2 = (n) => Math.round(Number(n) * 100) / 100;

export async function nextPoNumber(supabase) {
  const prefix = `PO-${new Date().getFullYear()}-`;
  const { data, error } = await supabase.from("purchase_orders").select("po_number").like("po_number", `${prefix}%`).order("po_number", { ascending: false }).limit(1);
  if (error) throw new Error(error.message);
  const last = data?.[0]?.po_number?.match(/-(\d+)$/);
  return prefix + String((last ? parseInt(last[1], 10) : 0) + 1).padStart(4, "0");
}

export async function activePoForOrder(marketplace, orderKey) {
  const supabase = await createClient();
  const { data } = await supabase.from("purchase_orders").select("id, po_number, status")
    .eq("source_marketplace", marketplace).eq("source_order_id", String(orderKey)).neq("status", "cancelled").maybeSingle();
  return data || null;
}

// order = enriched Shopify order from lib/orders
export function linesFromOrder(order, mpLabel = "Shopify") {
  return order.items.map((i) => {
    const p = i.product;
    const custom = !p && (!i.sku || /custom|purpose\s*made/i.test(`${i.title} ${i.variant}`));
    const excl = p ? (p.freeIssue ? 0 : p.cost) : null;
    return {
      warehouse_code: p?.code || null,
      description: p ? p.description : `${i.title}${i.variant ? " · " + i.variant : ""}`,
      quantity: i.qty,
      unit_cost_excl: excl != null ? r2(excl) : null,
      unit_cost_incl: excl != null ? r2(excl * VAT) : null,
      free_issue: !!p?.freeIssue,
      stock_issue: false,
      line_notes: p?.freeIssue ? "Free issue from EB stock" : custom ? "Purpose made · confirm size and price" : !p ? `Unmapped ${mpLabel} SKU ${i.sku}` : p.cost == null ? "No cost on file · confirm price" : null,
    };
  });
}

async function insertPo({ marketplace, key, ref, lines, waybills = [], notes = null, userId }) {
  const supabase = await createClient();
  const existing = await activePoForOrder(marketplace, key);
  if (existing) throw Object.assign(new Error(`${existing.po_number} already exists for ${ref}`), { status: 409, po: existing });
  if (!lines.length) throw new Error("This order has no items");

  let po, lastErr;
  for (let attempt = 0; attempt < 3 && !po; attempt++) {
    const po_number = await nextPoNumber(supabase);
    const { data, error } = await supabase.from("purchase_orders").insert({
      po_number,
      source_marketplace: marketplace,
      source_order_id: String(key),
      source_order_ref: ref,
      notes,
      created_by: userId,
      status: "draft",
      waybill_refs: waybills,
    }).select().single();
    if (!error) po = data; else lastErr = error; // retry on duplicate number
  }
  if (!po) throw new Error(lastErr?.message || "Couldn't create PO");

  const { error } = await supabase.from("purchase_order_lines").insert(lines.map((l, idx) => ({ ...l, po_id: po.id, display_order: idx })));
  if (error) {
    await supabase.from("purchase_orders").delete().eq("id", po.id);
    throw new Error(error.message);
  }
  return po;
}

export function createPoFromOrder(order, userId, { notes = null } = {}) {
  return insertPo({ marketplace: "shopify", key: order.key, ref: order.name, lines: linesFromOrder(order), waybills: order.tracking.map((t) => t.number).filter(Boolean), notes, userId });
}

// order = enriched Leroy Merlin order from lib/leroymerlin
export function createPoFromLmOrder(order, userId, { notes = null } = {}) {
  return insertPo({ marketplace: "leroymerlin", key: order.key, ref: order.name, lines: linesFromOrder(order, "Leroy Merlin"), waybills: order.tracking.map((t) => t.number).filter(Boolean), notes, userId });
}

// sale = enriched Takealot sale from lib/takealot
export function linesFromSale(sale) {
  const p = sale.product;
  const excl = p ? (p.freeIssue ? 0 : p.cost) : null;
  return [{
    warehouse_code: p?.code || null,
    description: p ? p.description : sale.title,
    quantity: sale.qty,
    unit_cost_excl: excl != null ? r2(excl) : null,
    unit_cost_incl: excl != null ? r2(excl * VAT) : null,
    free_issue: !!p?.freeIssue,
    stock_issue: false,
    line_notes: [`Takealot ${sale.dc || ""} DC`.replace("  ", " "), p?.freeIssue ? "Free issue from EB stock" : !p ? `Unmapped Takealot SKU ${sale.sku}` : p.cost == null ? "No cost on file · confirm price" : null].filter(Boolean).join(" · "),
  }];
}

export function createPoFromSale(sale, userId, { notes = null } = {}) {
  return insertPo({ marketplace: "takealot", key: sale.key, ref: sale.name, lines: linesFromSale(sale), notes, userId });
}

export async function getPo(id) {
  const supabase = await createClient();
  const { data: po, error } = await supabase.from("purchase_orders").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!po) return null;
  const { data: lines } = await supabase.from("purchase_order_lines").select("*").eq("po_id", id).order("display_order").order("warehouse_code");
  let log = [];
  try {
    const { data } = await supabase.from("po_email_log").select("*").eq("po_id", id).order("sent_at", { ascending: false });
    log = data || [];
  } catch {}
  let slip = null;
  if (po.source_slip_id) {
    const { data } = await supabase.from("picking_slips").select("id, slip_number, status").eq("id", po.source_slip_id).maybeSingle();
    slip = data || null;
  }
  return { ...po, lines: lines || [], log, source_slip: slip };
}

export async function listPos({ status } = {}) {
  const supabase = await createClient();
  let q = supabase.from("purchase_orders").select("*, purchase_order_lines(quantity, unit_cost_excl, free_issue)").order("created_at", { ascending: false }).limit(300);
  if (status) q = q.eq("status", status);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const old = Date.now() - 14 * 864e5;
  return (data || []).map(({ purchase_order_lines: ls, ...po }) => ({ ...po, lineCount: ls?.length || 0, stale: po.status === "draft" && new Date(po.created_at).getTime() < old, ...poTotals(ls || []) }));
}

export function poTotals(lines) {
  let excl = 0, free = 0, missing = 0;
  for (const l of lines) {
    if (l.free_issue) { free++; continue; }
    if (l.unit_cost_excl == null) { missing++; continue; }
    excl += Number(l.quantity || 0) * Number(l.unit_cost_excl);
  }
  excl = r2(excl);
  const vat = r2(excl * (VAT - 1));
  return { excl, vat, incl: r2(excl + vat), free, missing };
}

export async function updatePo(id, { status, notes, lines }) {
  const supabase = await createClient();
  const { data: po, error } = await supabase.from("purchase_orders").select("id, status").eq("id", id).single();
  if (error) throw new Error(error.message);

  if (Array.isArray(lines)) {
    if (po.status !== "draft") throw new Error("Only draft POs can be edited. Set it back to draft first.");
    const rows = lines.map((l, idx) => {
      const qty = Number(l.quantity);
      if (!(qty > 0)) throw new Error(`Line ${idx + 1}: quantity must be more than 0`);
      if (!String(l.description || "").trim()) throw new Error(`Line ${idx + 1}: description is required`);
      const excl = l.free_issue ? 0 : l.unit_cost_excl === "" || l.unit_cost_excl == null ? null : r2(l.unit_cost_excl);
      return {
        po_id: id,
        warehouse_code: String(l.warehouse_code || "").trim().toUpperCase() || null,
        description: String(l.description).trim(),
        quantity: qty,
        unit_cost_excl: excl,
        unit_cost_incl: excl == null ? null : r2(excl * VAT),
        free_issue: !!l.free_issue,
        stock_issue: !!l.stock_issue,
        line_notes: String(l.line_notes || "").trim() || null,
        display_order: idx,
      };
    });
    const { error: delErr } = await supabase.from("purchase_order_lines").delete().eq("po_id", id);
    if (delErr) throw new Error(delErr.message);
    if (rows.length) {
      const { error: insErr } = await supabase.from("purchase_order_lines").insert(rows);
      if (insErr) throw new Error(insErr.message);
    }
  }

  const patch = {};
  if (notes !== undefined) patch.notes = String(notes || "").trim() || null;
  if (status && status !== po.status) {
    if (!STATUSES.includes(status)) throw new Error("Unknown status");
    patch.status = status;
    const now = new Date().toISOString();
    if (status === "sent") patch.sent_at = now;
    if (status === "complete") patch.completed_at = now;
    if (status === "cancelled") patch.cancelled_at = now;
  }
  if (Object.keys(patch).length) {
    const { error: upErr } = await supabase.from("purchase_orders").update(patch).eq("id", id);
    if (upErr) throw new Error(upErr.message);
  }
  return getPo(id);
}
