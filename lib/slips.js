import "server-only";
import { createClient } from "@/lib/supabase-server";

// Picking slips — same `picking_slips` table as the old portal.
// order_refs: [{ marketplace, order_id }] (order_id = "EASYBARN2117")
// pick_state: { "shopify:EASYBARN2117": { picked, packed, courier_booked }, "shopify:EASYBARN2117:SKU": { picked, stock_issue } }

export const OPEN_STATUSES = ["created", "draft", "picking"];
export const READY_STATUSES = ["picked", "booking", "complete"];
export const SLIP_STATUSES = ["picking", "picked", "complete", "cancelled"];
export const LINE_TICKS = ["picked", "stock_issue"];
export const ORDER_TICKS = ["picked", "packed"];

export const orderKeyOf = (key) => `shopify:${key}`;
export const lineKeyOf = (key, item, idx) => `shopify:${key}:${item.sku || `NOSKU${idx}`}`;

// Is this order fully picked on its slip?
export function orderPicked(slip, order) {
  if (!slip) return false;
  if (READY_STATUSES.includes(slip.status)) return true;
  const st = slip.pick_state || {};
  if (st[orderKeyOf(order.key)]?.picked) return true;
  return order.items.length > 0 && order.items.every((i, idx) => st[lineKeyOf(order.key, i, idx)]?.picked);
}

async function nextSlipNumber(supabase) {
  const prefix = `PS-${new Date().getFullYear()}-`;
  const { data } = await supabase.from("picking_slips").select("slip_number").like("slip_number", `${prefix}%`).order("slip_number", { ascending: false }).limit(1);
  const last = data?.[0]?.slip_number?.match(/-(\d+)$/);
  return prefix + String((last ? parseInt(last[1], 10) : 0) + 1).padStart(4, "0");
}

export async function listSlips({ status } = {}) {
  const supabase = await createClient();
  let q = supabase.from("picking_slips").select("id, slip_number, status, notes, order_refs, pick_state, waybill_refs, created_at, updated_at").order("created_at", { ascending: false }).limit(200);
  if (status === "open") q = q.in("status", OPEN_STATUSES);
  else if (status) q = q.eq("status", status);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data || [];
}

export async function getSlipRow(id) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("picking_slips").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

// Which open/ready slip (if any) already holds each order
async function slipsHolding(supabase, keys) {
  const { data } = await supabase.from("picking_slips").select("id, slip_number, status, order_refs").neq("status", "cancelled").neq("status", "complete");
  const held = {};
  for (const s of data || []) for (const r of s.order_refs || []) if (r.marketplace === "shopify" && keys.includes(String(r.order_id))) held[r.order_id] = s.slip_number;
  return held;
}

export async function createSlip(orderKeys, userId, notes) {
  const supabase = await createClient();
  const keys = [...new Set(orderKeys.map(String))];
  if (!keys.length) throw new Error("Select at least one order");
  const held = await slipsHolding(supabase, keys);
  const clash = keys.filter((k) => held[k]);
  if (clash.length) throw new Error(`Already on a slip: ${clash.map((k) => `#${k} (${held[k]})`).join(", ")}`);
  let slip, lastErr;
  for (let i = 0; i < 3 && !slip; i++) {
    const { data, error } = await supabase.from("picking_slips").insert({
      slip_number: await nextSlipNumber(supabase), created_by: userId, status: "picking",
      order_refs: keys.map((k) => ({ marketplace: "shopify", order_id: k })), pick_state: {}, notes: notes || null,
    }).select().single();
    if (!error) slip = data; else lastErr = error;
  }
  if (!slip) throw new Error(lastErr?.message || "Couldn't create slip");
  return slip;
}

export async function addOrdersToSlip(id, orderKeys) {
  const supabase = await createClient();
  const slip = await getSlipRow(id);
  if (!slip) throw new Error("Slip not found");
  if (!OPEN_STATUSES.includes(slip.status)) throw new Error(`${slip.slip_number} is ${slip.status}; add orders to an open slip`);
  const keys = [...new Set(orderKeys.map(String))].filter((k) => !(slip.order_refs || []).some((r) => r.marketplace === "shopify" && String(r.order_id) === k));
  const held = await slipsHolding(supabase, keys);
  const clash = keys.filter((k) => held[k]);
  if (clash.length) throw new Error(`Already on a slip: ${clash.map((k) => `#${k} (${held[k]})`).join(", ")}`);
  const order_refs = [...(slip.order_refs || []), ...keys.map((k) => ({ marketplace: "shopify", order_id: k }))];
  const { error } = await supabase.from("picking_slips").update({ order_refs }).eq("id", id);
  if (error) throw new Error(error.message);
  return { ...slip, order_refs, added: keys.length };
}

export async function removeOrderFromSlip(id, orderKey) {
  const supabase = await createClient();
  const slip = await getSlipRow(id);
  if (!slip) throw new Error("Slip not found");
  const order_refs = (slip.order_refs || []).filter((r) => !(r.marketplace === "shopify" && String(r.order_id) === String(orderKey)));
  const prefix = orderKeyOf(orderKey);
  const pick_state = Object.fromEntries(Object.entries(slip.pick_state || {}).filter(([k]) => k !== prefix && !k.startsWith(prefix + ":")));
  const { error } = await supabase.from("picking_slips").update({ order_refs, pick_state }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function tickSlip(id, keys, tick, value, email) {
  keys = [].concat(keys).filter(Boolean);
  if (!keys.length) throw new Error("Nothing to tick");
  for (const key of keys) {
    const allowed = key.split(":").length > 2 ? LINE_TICKS : ORDER_TICKS;
    if (!allowed.includes(tick)) throw new Error("Unknown tick");
  }
  const supabase = await createClient();
  const slip = await getSlipRow(id);
  if (!slip) throw new Error("Slip not found");
  const st = { ...(slip.pick_state || {}) };
  for (const key of keys) {
    const item = { ...(st[key] || {}) };
    item[tick] = !!value;
    if (value) { item[`${tick}_at`] = new Date().toISOString(); item[`${tick}_by`] = email || null; }
    else { delete item[`${tick}_at`]; delete item[`${tick}_by`]; }
    st[key] = item;
  }
  // First tick moves a fresh slip into "picking"
  const patch = { pick_state: st };
  if (slip.status === "created" || slip.status === "draft") patch.status = "picking";
  const { error } = await supabase.from("picking_slips").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
  return st;
}

export async function setSlipStatus(id, status, notes) {
  if (status && !SLIP_STATUSES.includes(status)) throw new Error("Unknown status");
  const supabase = await createClient();
  const patch = {};
  if (status) patch.status = status;
  if (notes !== undefined) patch.notes = String(notes || "").trim() || null;
  const { error } = await supabase.from("picking_slips").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
}
