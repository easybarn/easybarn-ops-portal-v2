import { NextResponse } from "next/server";
import { apiUser, fail } from "@/lib/auth";
import { createClient } from "@/lib/supabase-server";
import { getPo, updatePo } from "@/lib/purchase-orders";
import { generatePoPdf } from "@/lib/po-pdf";
import { sendPosEmail } from "@/lib/po-email";

// POST { ids: [...], to?, message? } → ONE email to P&P with every selected PO attached.
// Each PO gets an email-log row; drafts are marked sent.
export async function POST(request) {
  const { ctx, res } = await apiUser();
  if (res) return res;
  let body;
  try { body = await request.json(); } catch { return fail(new Error("Invalid request"), 400); }
  const ids = [...new Set(body.ids || [])].slice(0, 40);
  if (!ids.length) return fail(new Error("No POs selected"), 400);

  const items = [], skipped = [];
  for (const id of ids) {
    const po = await getPo(id);
    if (!po) { skipped.push({ id, reason: "not found" }); continue; }
    if (po.status === "cancelled") { skipped.push({ id, po_number: po.po_number, reason: "cancelled" }); continue; }
    if (!po.lines.length) { skipped.push({ id, po_number: po.po_number, reason: "no lines" }); continue; }
    items.push({ po, pdf: await generatePoPdf(po) });
  }
  if (!items.length) return fail(new Error("None of the selected POs can be sent: " + skipped.map((s) => `${s.po_number || s.id} (${s.reason})`).join(", ")), 400);

  const result = await sendPosEmail(items, { to: body.to?.trim() || undefined, message: body.message });
  const supabase = await createClient();
  for (const { po } of items) {
    try {
      await supabase.from("po_email_log").insert({
        po_id: po.id, sent_at: new Date().toISOString(), sent_by: ctx.user.id,
        sent_to: (result.to || []).join(", "), sent_cc: (result.cc || []).join(", "), sent_from: result.from || "",
        success: !!result.success, message_id: result.message_id || null,
        error_message: result.error || null,
      });
    } catch {}
  }
  if (!result.success) return fail(new Error(result.error), 502);
  for (const { po } of items) if (po.status === "draft") { try { await updatePo(po.id, { status: "sent" }); } catch {} }
  return NextResponse.json({ success: true, sent: items.map(({ po }) => po.po_number), skipped, to: result.to, cc: result.cc });
}
