import "server-only";
import { BUYER, SUPPLIER, poTotals } from "@/lib/purchase-orders";

// Emails PO PDFs to Panel & Pane via the Resend API. One email can carry several POs.
// Env: RESEND_API_KEY (required), PO_FROM_EMAIL, PO_RECIPIENT_EMAIL, PO_CC_EMAILS (comma list), PO_REPLY_TO
export function emailConfig() {
  return {
    ready: !!process.env.RESEND_API_KEY,
    from: process.env.PO_FROM_EMAIL || "Easy Barn <hello@easybarn.co.za>",
    to: process.env.PO_RECIPIENT_EMAIL || SUPPLIER.email,
    cc: (process.env.PO_CC_EMAILS || "").split(",").map((s) => s.trim()).filter(Boolean),
    replyTo: process.env.PO_REPLY_TO || "steven@panelandpane.co.za",
  };
}

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const zar = (n) => "R " + Number(n || 0).toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const cell = "padding:4px 8px;border-bottom:1px solid #e1e4e8";

function poBlock(po) {
  const tot = poTotals(po.lines);
  const rows = po.lines.map((l) => `<tr><td style="${cell};font-family:monospace">${esc(l.warehouse_code || "-")}</td><td style="${cell}">${esc(l.description)}</td><td style="${cell};text-align:right">${l.quantity}</td><td style="${cell};text-align:right">${l.free_issue ? "free issue" : l.unit_cost_excl == null ? "TBC" : zar(l.unit_cost_excl * l.quantity)}</td></tr>`).join("");
  return `<h3 style="margin:18px 0 4px;font-size:15px">${esc(po.po_number)}${po.source_order_ref ? ` <span style="font-weight:normal;color:#646c76">· customer order ${esc(po.source_order_ref)}</span>` : ""}</h3>
<table style="border-collapse:collapse;font-size:13px;width:100%"><thead><tr style="background:#16191d;color:#fff"><th style="padding:5px 8px;text-align:left">Code</th><th style="padding:5px 8px;text-align:left">Description</th><th style="padding:5px 8px;text-align:right">Qty</th><th style="padding:5px 8px;text-align:right">Excl VAT</th></tr></thead><tbody>${rows}</tbody></table>
<p style="margin:4px 0 0;text-align:right"><b>Total incl VAT ${zar(tot.incl)}</b>${tot.missing ? ` · ${tot.missing} line(s) TBC` : ""}</p>
${po.notes ? `<p style="background:#fdf1dc;padding:6px 10px;margin:6px 0 0"><b>Notes:</b> ${esc(po.notes)}</p>` : ""}`;
}

// items: [{ po, pdf }]
export async function sendPosEmail(items, { to, cc, message } = {}) {
  const cfg = emailConfig();
  const recipients = to ? [to] : [cfg.to];
  const ccList = cc ?? cfg.cc;
  const base = { from: cfg.from, to: recipients, cc: ccList };
  if (!cfg.ready) return { success: false, error: "RESEND_API_KEY is not set in .env.local", ...base };
  if (!items.length) return { success: false, error: "No POs to send", ...base };

  const many = items.length > 1;
  const grand = items.reduce((s, { po }) => s + poTotals(po.lines).incl, 0);
  const numbers = items.map(({ po }) => po.po_number);
  const subject = many
    ? `${items.length} Purchase Orders (${numbers[0]} – ${numbers[numbers.length - 1]}) · ${BUYER.name}`
    : `Purchase Order ${numbers[0]}${items[0].po.source_order_ref ? ` · ${items[0].po.source_order_ref}` : ""} · ${BUYER.name}`;
  const html = `<div style="font-family:Arial,sans-serif;font-size:14px;color:#16191d;max-width:680px">
<p>Hi Panel &amp; Pane team,</p>
<p>Please find ${many ? `<b>${items.length} purchase orders</b>` : `purchase order <b>${esc(numbers[0])}</b>`} from ${esc(BUYER.name)} attached${many ? ` (one PDF each)` : ""}.</p>
${message ? `<p>${esc(message).replace(/\n/g, "<br>")}</p>` : ""}
${items.map(({ po }) => poBlock(po)).join("")}
${many ? `<p style="margin-top:16px;font-size:15px"><b>Combined total incl VAT: ${zar(grand)}</b></p>` : ""}
<p>Reply to this email if anything looks wrong.</p>
<p>Thanks,<br>Steven<br>${esc(BUYER.name)} ${esc(BUYER.tradingAs)}</p></div>`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json", "Idempotency-Key": `${numbers.join("_")}-${Date.now()}`.slice(0, 250) },
      body: JSON.stringify({
        from: cfg.from,
        to: recipients,
        cc: ccList.length ? ccList : undefined,
        reply_to: cfg.replyTo,
        subject,
        html,
        attachments: items.map(({ po, pdf }) => ({ filename: `${po.po_number}.pdf`, content: Buffer.from(pdf).toString("base64") })),
      }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) return { success: false, error: d.message || `Resend ${res.status}`, ...base };
    return { success: true, message_id: d.id, ...base };
  } catch (e) {
    return { success: false, error: e.message, ...base };
  }
}

export const sendPoEmail = (po, pdf, opts) => sendPosEmail([{ po, pdf }], opts);
