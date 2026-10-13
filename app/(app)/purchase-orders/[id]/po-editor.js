"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileText, Download, Mail, Plus, Trash2, X } from "lucide-react";
import { PageHeader, Panel, Button, Badge, Notice, Field, btnClass, cx } from "@/components/ui";
import { PO_TONE } from "@/lib/po-ui";
import { zar, shortDate, ago, VAT } from "@/lib/format";

const blank = () => ({ warehouse_code: "", description: "", quantity: 1, unit_cost_excl: "", free_issue: false, line_notes: "" });

function totals(lines) {
  let excl = 0, missing = 0;
  for (const l of lines) {
    if (l.free_issue) continue;
    if (l.unit_cost_excl === "" || l.unit_cost_excl == null) { missing++; continue; }
    excl += Number(l.quantity || 0) * Number(l.unit_cost_excl);
  }
  return { excl, vat: excl * (VAT - 1), incl: excl * VAT, missing };
}

function EmailDialog({ po, email, onClose, onSent }) {
  const [to, setTo] = useState(email.to);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function send() {
    setBusy(true); setError("");
    const res = await fetch(`/api/purchase-orders/${po.id}/send`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ to, message }) });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setError(d.error || "Email failed"); return; }
    onSent(`Emailed ${po.po_number} to ${d.to.join(", ")}${d.cc?.length ? ` (cc ${d.cc.join(", ")})` : ""}.`);
  }
  return (
    <div className="fixed inset-0 z-50 bg-black/45 flex items-start md:items-center justify-center p-3" onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <div role="dialog" aria-modal="true" aria-label="Email PO" className="bg-panel border border-line rounded-md w-full max-w-[520px] shadow-2xl">
        <div className="flex items-center gap-2 px-4 h-11 border-b border-line"><Mail size={15} className="text-accent" /><b>Email {po.po_number} to Panel &amp; Pane</b><button className="ml-auto p-1 text-muted hover:text-ink" onClick={onClose} aria-label="Close"><X size={16} /></button></div>
        <div className="p-4 grid gap-3">
          {!email.ready ? <Notice tone="warn">Email isn&apos;t set up yet: add <span className="num">RESEND_API_KEY</span> (and optionally <span className="num">PO_FROM_EMAIL</span>, <span className="num">PO_RECIPIENT_EMAIL</span>, <span className="num">PO_CC_EMAILS</span>) to .env.local. You can still download the PDF.</Notice> : null}
          {error ? <Notice tone="bad">{error}</Notice> : null}
          <Field label="To"><input className="input" type="email" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
          {email.cc.length ? <div className="text-[12px] text-muted">CC {email.cc.join(", ")}</div> : null}
          <Field label="Message (optional)"><textarea className="input" rows={3} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="e.g. Needed by Friday please" /></Field>
          <div className="text-[12px] text-muted">The PDF is attached. {po.status === "draft" ? "The PO will be marked as sent." : ""}</div>
          <div className="flex justify-end gap-2"><Button onClick={onClose} disabled={busy}>Cancel</Button><Button variant="primary" onClick={send} disabled={busy || !email.ready || !to}>{busy ? "Sending…" : "Send email"}</Button></div>
        </div>
      </div>
    </div>
  );
}

export default function PoEditor({ po, isAdmin, buyer, supplier, email }) {
  const router = useRouter();
  const [lines, setLines] = useState(() => po.lines.map((l) => ({ ...l, unit_cost_excl: l.unit_cost_excl ?? "", line_notes: l.line_notes || "", warehouse_code: l.warehouse_code || "" })));
  const [notes, setNotes] = useState(po.notes || "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [mail, setMail] = useState(false);
  const editable = isAdmin && po.status === "draft";
  const t = useMemo(() => totals(lines), [lines]);
  const dirty = JSON.stringify(lines.map(({ warehouse_code, description, quantity, unit_cost_excl, free_issue, line_notes }) => [warehouse_code, description, Number(quantity), String(unit_cost_excl), !!free_issue, line_notes])) !==
    JSON.stringify(po.lines.map((l) => [l.warehouse_code || "", l.description, Number(l.quantity), String(l.unit_cost_excl ?? ""), !!l.free_issue, l.line_notes || ""])) || notes !== (po.notes || "");
  const upd = (i, patch) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  async function patch(body, ok) {
    setBusy(true); setMsg(null);
    const res = await fetch(`/api/purchase-orders/${po.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setMsg({ tone: "bad", text: d.error || "Save failed" }); return; }
    setMsg({ tone: "ok", text: ok });
    router.refresh();
  }
  const save = () => patch({ lines, notes }, "Saved.");
  const setStatus = (status, confirmText) => { if (confirmText && !window.confirm(confirmText)) return; patch({ status }, `Marked ${status}.`); };

  return (
    <div>
      <PageHeader
        crumbs={[{ label: "Purchase orders", href: "/purchase-orders" }, { label: po.po_number }]}
        title={<span className="flex items-center gap-2"><span className="num">{po.po_number}</span><Badge tone={PO_TONE[po.status]}>{po.status}</Badge></span>}
        sub={<>Created {shortDate(po.created_at)}{po.sent_at ? ` · sent ${shortDate(po.sent_at)}` : ""}{po.source_order_ref ? <> · for <Link className="num hover:text-accent" href={`/orders/${po.source_order_id}`}>{po.source_order_ref}</Link></> : null}</>}
        actions={
          <>
            <a className={btnClass()} href={`/api/purchase-orders/${po.id}/pdf`} target="_blank" rel="noreferrer"><FileText size={14} /> View PDF</a>
            <a className={btnClass()} href={`/api/purchase-orders/${po.id}/pdf?download=1`}><Download size={14} /> Download</a>
            {po.status !== "cancelled" ? <Button variant="primary" onClick={() => setMail(true)} disabled={dirty || busy} title={dirty ? "Save changes first" : ""}><Mail size={14} /> Email to P&amp;P</Button> : null}
          </>
        }
      />
      {msg ? <div className="mb-3"><Notice tone={msg.tone}>{msg.text}</Notice></div> : null}
      {t.missing && po.status !== "cancelled" ? <div className="mb-3"><Notice tone="warn">{t.missing} line{t.missing > 1 ? "s have" : " has"} no price yet and will show as TBC on the PDF.</Notice></div> : null}

      <div className="grid xl:grid-cols-[1fr_300px] gap-3 items-start">
        <div className="grid gap-3">
          <Panel title="Lines" pad={false} actions={editable ? <Button size="sm" onClick={() => setLines((ls) => [...ls, blank()])}><Plus size={13} /> Add line</Button> : null}>
            <div className="overflow-x-auto">
              <table className="tbl">
                <thead><tr><th>Code</th><th>Description · note</th><th className="r">Qty</th><th className="r">Unit excl</th><th className="r">Line excl</th><th>Free issue</th>{editable ? <th></th> : null}</tr></thead>
                <tbody>
                  {lines.map((l, i) => (
                    <tr key={i}>
                      <td className="align-top">{editable ? <input className="input num !w-[110px] !h-[26px]" value={l.warehouse_code} onChange={(e) => upd(i, { warehouse_code: e.target.value.toUpperCase() })} /> : <span className="num font-semibold">{l.warehouse_code || "—"}</span>}</td>
                      <td className="align-top min-w-[260px]">
                        {editable ? (
                          <div className="grid gap-1">
                            <input className="input !h-[26px]" value={l.description} onChange={(e) => upd(i, { description: e.target.value })} />
                            <input className="input !h-[24px] text-[12px]" placeholder="Line note" value={l.line_notes} onChange={(e) => upd(i, { line_notes: e.target.value })} />
                          </div>
                        ) : (<><div>{l.description}</div>{l.line_notes ? <div className="text-[11px] text-faint">{l.line_notes}</div> : null}</>)}
                      </td>
                      <td className="align-top r">{editable ? <input type="number" min="1" className="input num !w-[60px] !h-[26px] text-right" value={l.quantity} onChange={(e) => upd(i, { quantity: e.target.value })} /> : <span className="num">{l.quantity}</span>}</td>
                      <td className="align-top r">{l.free_issue ? <span className="text-faint">—</span> : editable ? <input type="number" min="0" step="0.01" className={cx("input num !w-[100px] !h-[26px] text-right", l.unit_cost_excl === "" && "!border-warn")} placeholder="TBC" value={l.unit_cost_excl} onChange={(e) => upd(i, { unit_cost_excl: e.target.value })} /> : <span className="num">{l.unit_cost_excl === "" ? "TBC" : zar(l.unit_cost_excl)}</span>}</td>
                      <td className="align-top r num whitespace-nowrap">{l.free_issue ? <Badge tone="info">free</Badge> : l.unit_cost_excl === "" ? <span className="text-warn">TBC</span> : zar(Number(l.unit_cost_excl) * Number(l.quantity || 0))}</td>
                      <td className="align-top"><input type="checkbox" checked={!!l.free_issue} disabled={!editable} onChange={(e) => upd(i, { free_issue: e.target.checked })} aria-label="Free issue" /></td>
                      {editable ? <td className="align-top"><button className="p-1 text-faint hover:text-bad" onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))} aria-label="Remove line"><Trash2 size={13} /></button></td> : null}
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr><td colSpan={4} className="r text-muted">Subtotal excl VAT</td><td className="r num">{zar(t.excl)}</td><td colSpan={editable ? 2 : 1}></td></tr>
                  <tr><td colSpan={4} className="r text-muted">VAT 15%</td><td className="r num">{zar(t.vat)}</td><td colSpan={editable ? 2 : 1}></td></tr>
                  <tr><td colSpan={4} className="r font-semibold">Total incl VAT</td><td className="r num font-semibold text-accent">{zar(t.incl)}</td><td colSpan={editable ? 2 : 1}></td></tr>
                </tfoot>
              </table>
            </div>
          </Panel>
          <Panel title="Notes for Panel & Pane">
            {editable ? <textarea className="input" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Delivery date, finishes, anything P&P must know" /> : <p className="whitespace-pre-wrap">{po.notes || <span className="text-faint">None</span>}</p>}
          </Panel>
          {editable ? <div className="flex justify-end"><Button variant="primary" onClick={save} disabled={!dirty || busy}>{busy ? "Saving…" : dirty ? "Save changes" : "Saved"}</Button></div> : null}
          {!editable && isAdmin && po.status !== "draft" ? <p className="text-[12px] text-faint">Only draft POs can be edited. Set it back to draft to change lines.</p> : null}
        </div>

        <div className="grid gap-3">
          <Panel title="Parties">
            <div className="grid gap-2 text-[12px]">
              <div><div className="text-faint text-[10.5px] uppercase tracking-wide">Buyer</div><b>{buyer.name}</b><div className="text-muted">{buyer.tradingAs}</div></div>
              <div><div className="text-faint text-[10.5px] uppercase tracking-wide">Supplier</div><b>{supplier.name}</b><div className="text-muted">{supplier.lines.join(", ")}</div></div>
            </div>
          </Panel>
          {isAdmin ? (
            <Panel title="Status">
              <div className="flex flex-wrap gap-1.5">
                {po.status === "draft" ? <Button size="sm" onClick={() => setStatus("sent")} disabled={busy}>Mark sent (no email)</Button> : null}
                {po.status === "sent" ? <Button size="sm" onClick={() => setStatus("complete")} disabled={busy}>Mark complete</Button> : null}
                {po.status !== "draft" && po.status !== "complete" ? <Button size="sm" onClick={() => setStatus("draft")} disabled={busy}>Back to draft</Button> : null}
                {po.status !== "cancelled" ? <Button size="sm" variant="danger" onClick={() => setStatus("cancelled", `Cancel ${po.po_number}? A new PO can then be created for this order.`)} disabled={busy}>Cancel PO</Button> : null}
              </div>
            </Panel>
          ) : null}
          {po.waybill_refs?.length ? <Panel title="Waybills"><div className="num">{po.waybill_refs.join(", ")}</div></Panel> : null}
          <Panel title="Email log" pad={false}>
            {po.log.length ? (
              <table className="tbl"><tbody>{po.log.map((l) => (
                <tr key={l.id}><td><Badge tone={l.success ? "ok" : "bad"}>{l.success ? "sent" : "failed"}</Badge></td><td className="text-[12px]">{l.sent_to}{l.error_message ? <div className="text-bad text-[11px]">{l.error_message}</div> : null}</td><td className="text-muted text-[11px] whitespace-nowrap">{ago(l.sent_at)}</td></tr>
              ))}</tbody></table>
            ) : <p className="p-3 text-faint text-[12px]">Not emailed yet.</p>}
          </Panel>
        </div>
      </div>
      {mail ? <EmailDialog po={po} email={email} onClose={() => setMail(false)} onSent={(text) => { setMail(false); setMsg({ tone: "ok", text }); router.refresh(); }} /> : null}
    </div>
  );
}
