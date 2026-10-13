import "server-only";
// Helper that propagates a newly-booked waybill to:
//   - Any active picking slip that contains this order (appends to slip.waybill_refs)
//   - Any active PO whose source_order_id matches (appends to po.waybill_refs)
//
// Best-effort: if neither is found, logs and returns silently. Doesn't fail
// the courier booking just because portal-internal linkage is missing.

import { createClient } from "@/lib/supabase-server";

export async function syncWaybillToSlipAndPo({ marketplace, orderId, waybill }) {
  if (!waybill || !marketplace || !orderId) {
    return { updated: { slips: 0, pos: 0 }, reason: "missing args" };
  }

  const supabase = await createClient();
  const result = { updated: { slips: 0, pos: 0 } };

  // === 1. Update any picking slip with this order ===
  // Slips have order_refs JSONB array of { marketplace, order_id }
  // Limit to non-terminal slips (not complete/cancelled) so historical slips aren't disturbed.
  try {
    const { data: slips, error: slipsErr } = await supabase
      .from("picking_slips")
      .select("id, slip_number, waybill_refs, order_refs, status")
      .neq("status", "cancelled")
      .neq("status", "complete");
    if (slipsErr) throw slipsErr;

    for (const slip of slips || []) {
      const refs = slip.order_refs || [];
      const matches = refs.some(
        (r) => r.marketplace === marketplace && String(r.order_id) === String(orderId)
      );
      if (!matches) continue;

      const existing = Array.isArray(slip.waybill_refs) ? slip.waybill_refs : [];
      if (existing.includes(waybill)) continue; // already there
      const updated = [...existing, waybill];
      const { error: upErr } = await supabase
        .from("picking_slips")
        .update({ waybill_refs: updated })
        .eq("id", slip.id);
      if (!upErr) result.updated.slips++;
    }
  } catch (e) {
    result.slipError = e.message;
  }

  // === 2. Update any active PO for this order ===
  try {
    const { data: pos, error: posErr } = await supabase
      .from("purchase_orders")
      .select("id, po_number, waybill_refs")
      .eq("source_marketplace", marketplace)
      .eq("source_order_id", String(orderId))
      .neq("status", "cancelled");
    if (posErr) throw posErr;

    for (const po of pos || []) {
      const existing = Array.isArray(po.waybill_refs) ? po.waybill_refs : [];
      if (existing.includes(waybill)) continue;
      const updated = [...existing, waybill];
      const { error: upErr } = await supabase
        .from("purchase_orders")
        .update({ waybill_refs: updated })
        .eq("id", po.id);
      if (!upErr) result.updated.pos++;
    }
  } catch (e) {
    result.poError = e.message;
  }

  return result;
}
