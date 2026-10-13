import { NextResponse } from "next/server";
import { apiUser, fail } from "@/lib/auth";
import { createClient } from "@/lib/supabase-server";
import { getPo, updatePo } from "@/lib/purchase-orders";
import { generatePoPdf } from "@/lib/po-pdf";
import { sendPoEmail } from "@/lib/po-email";

// POST { to?, message? } → emails the PDF to Panel & Pane, logs it, marks a draft as sent
export async function POST(request, { params }) {
  const { ctx, res } = await apiUser();
  if (res) return res;
  const { id } = await params;
  try {
    const body = await request.json().catch(() => ({}));
    const po = await getPo(id);
    if (!po) return fail(new Error("PO not found"), 404);
    if (po.status === "cancelled") return fail(new Error("This PO is cancelled"), 400);
    if (!po.lines.length) return fail(new Error("This PO has no lines"), 400);

    const result = await sendPoEmail(po, await generatePoPdf(po), { to: body.to?.trim() || undefined, message: body.message });
    try {
      const supabase = await createClient();
      await supabase.from("po_email_log").insert({
        po_id: po.id, sent_at: new Date().toISOString(), sent_by: ctx.user.id,
        sent_to: (result.to || []).join(", "), sent_cc: (result.cc || []).join(", "), sent_from: result.from || "",
        success: !!result.success, message_id: result.message_id || null, error_message: result.error || null,
      });
    } catch {}
    if (!result.success) return fail(new Error(result.error), 502);
    if (po.status === "draft") await updatePo(id, { status: "sent" });
    return NextResponse.json({ success: true, to: result.to, cc: result.cc });
  } catch (e) { return fail(e); }
}
