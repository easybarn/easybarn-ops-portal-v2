"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mail, X } from "lucide-react";
import { Badge, Button, Empty, Field, Notice, cx } from "@/components/ui";
import { PO_TONE } from "@/lib/po-ui";
import { zar, shortDate } from "@/lib/format";

function BatchEmail({ pos, email, onClose, onDone }) {
  const [to, setTo] = useState(email.to);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const total = pos.reduce((s, p) => s + p.incl, 0);
  const tbc = pos.filter((p) => p.missing).length;
  async function send() {
    setBusy(true); setError("");
    const res = await fetch("/api/purchase-orders/send-batch", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: pos.map((p) => p.id), to, message }) });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setError(d.error || "Email failed"); return; }
    onDone(`Emailed ${d.sent.length} PO${d.sent.length === 1 ? "" : "s"} (${d.sent.join(", ")}) to ${d.to.join(", ")} in one email.` + (d.skipped?.length ? ` Skipped ${d.skipped.map((s) => `${s.po_number || "?"} (${s.reason})`).join(", ")}.` : ""));
  }
  return (
    <div className="fixed inset-0 z-50 bg-black/45 flex items-start md:items-center justify-center p-3" onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <div role="dialog" aria-modal="true" aria-label="Email POs" className="bg-panel border border-line rounded-md w-full max-w-[560px] shadow-2xl">
        <div className="flex items-center gap-2 px-4 h-11 border-b border-line"><Mail size={15} className="text-accent" /><b>Email {pos.length} PO{pos.length === 1 ? "" : "s"} to Panel &amp; Pane</b><button className="ml-auto p-1 text-muted hover:text-ink" onClick={onClose} aria-label="Close" disabled={busy}><X size={16} /></button></div>
        <div className="p-4 grid gap-3">
          {!email.ready ? <Notice tone="warn">Email isn&apos;t set up yet: add <span className="num">RESEND_API_KEY</span> and <span className="num">PO_FROM_EMAIL</span> to .env.local, then restart.</Notice> : null}
          {tbc ? <Notice tone="warn">{tbc} of these PO{tbc === 1 ? " has" : "s have"} lines priced TBC.</Notice> : null}
          {error ? <Notice tone="bad">{error}</Notice> : null}
          <div className="max-h-[180px] overflow-auto border border-line rounded">
            <table className="tbl"><tbody>{pos.map((p) => (
              <tr key={p.id}><td className="num font-semibold">{p.po_number}</td><td className="num text-muted">{p.source_order_ref}</td><td className="r num">{zar(p.incl)}</td></tr>
            ))}</tbody></table>
          </div>
          <div className="text-[12px] text-muted">One email, {pos.length} PDF attachment{pos.length === 1 ? "" : "s"}, combined total <b className="num">{zar(total)}</b> incl VAT. Drafts will be marked sent.</div>
          <Field label="To"><input className="input" type="email" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
          {email.cc.length ? <div className="text-[12px] text-muted">CC {email.cc.join(", ")}</div> : null}
          <Field label="Message (optional)"><textarea className="input" rows={2} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="e.g. Please confirm lead times" /></Field>
          <div className="flex justify-end gap-2"><Button onClick={onClose} disabled={busy}>Cancel</Button><Button variant="primary" onClick={send} disabled={busy || !email.ready || !to}>{busy ? "Sending…" : `Send ${pos.length} PO${pos.length === 1 ? "" : "s"}`}</Button></div>
        </div>
      </div>
    </div>
  );
}

export default function PoTable({ pos, email, queueView }) {
  const router = useRouter();
  const sendable = pos.filter((p) => p.status !== "cancelled" && p.lineCount > 0);
  // Select-all skips stale drafts (older than 14 days) so leftovers aren't emailed by accident
  const recent = sendable.filter((p) => !p.stale);
  const [sel, setSel] = useState(() => new Set());
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState(null);
  const chosen = pos.filter((p) => sel.has(p.id));
  const pickAll = queueView ? recent : sendable;
  const allOn = pickAll.length > 0 && pickAll.every((p) => sel.has(p.id));
  const toggle = (id) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  return (
    <>
      {msg ? <div className="mb-2"><Notice tone="ok">{msg}</Notice></div> : null}
      <div className="mb-2 flex flex-wrap items-center gap-2 px-3 py-2 rounded-md border border-line bg-panel">
        <b>{chosen.length} selected</b>
        <span className="text-[12px] text-muted num">{zar(chosen.reduce((s, p) => s + p.incl, 0))} incl VAT</span>
        <Button size="sm" variant="primary" onClick={() => setOpen(true)} disabled={!chosen.length}><Mail size={13} /> Email selected to P&amp;P</Button>
        {chosen.length ? <Button size="sm" variant="ghost" onClick={() => setSel(new Set())}>Clear</Button> : null}
        {queueView ? <span className="ml-auto text-[12px] text-muted">Send queue = draft POs not yet emailed. Tick the header box to select all recent drafts.</span> : null}
      </div>
      <div className="bg-panel border border-line rounded-md">
        {pos.length ? (
          <div className="overflow-auto max-h-[calc(100vh-250px)]">
            <table className="tbl">
              <thead><tr>
                <th className="w-8"><input type="checkbox" aria-label="Select all" title={queueView ? "Select all drafts from the last 14 days" : "Select all"} checked={allOn} disabled={!pickAll.length} onChange={() => setSel(allOn ? new Set() : new Set(pickAll.map((p) => p.id)))} /></th>
                <th>PO</th><th>Status</th><th>Customer order</th><th className="r">Lines</th><th className="r">Excl VAT</th><th className="r">Incl VAT</th><th>Created</th><th>Sent</th>
              </tr></thead>
              <tbody>
                {pos.map((p) => {
                  const can = p.status !== "cancelled" && p.lineCount > 0;
                  return (
                    <tr key={p.id} className={cx(can && "cursor-pointer", sel.has(p.id) && "[&>td]:!bg-accent-soft")} onClick={() => can && toggle(p.id)}>
                      <td onClick={(e) => e.stopPropagation()}>{can ? <input type="checkbox" aria-label={`Select ${p.po_number}`} checked={sel.has(p.id)} onChange={() => toggle(p.id)} /> : null}</td>
                      <td className="whitespace-nowrap"><Link href={`/purchase-orders/${p.id}`} className="num font-semibold hover:text-accent" onClick={(e) => e.stopPropagation()}>{p.po_number}</Link></td>
                      <td className="whitespace-nowrap"><Badge tone={PO_TONE[p.status]}>{p.status}</Badge>{p.stale ? <Badge tone="bad" className="ml-1">old draft</Badge> : null}{p.status !== "cancelled" && !p.incl && !p.free ? <Badge tone="warn" className="ml-1">R0</Badge> : null}</td>
                      <td className="whitespace-nowrap">{p.source_marketplace === "shopify" && p.source_order_id ? <Link href={`/orders/${p.source_order_id}`} className="num hover:text-accent" onClick={(e) => e.stopPropagation()}>{p.source_order_ref || p.source_order_id}</Link> : <span className="num text-muted">{p.source_order_ref || "—"}</span>} <span className="text-[11px] text-faint">{p.source_marketplace}</span></td>
                      <td className="r num">{p.lineCount}{p.missing ? <span className="text-warn"> · {p.missing} TBC</span> : null}</td>
                      <td className="r num whitespace-nowrap">{zar(p.excl)}</td>
                      <td className="r num font-semibold whitespace-nowrap">{zar(p.incl)}</td>
                      <td className="text-muted whitespace-nowrap">{shortDate(p.created_at)}</td>
                      <td className="text-muted whitespace-nowrap">{p.sent_at ? shortDate(p.sent_at) : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : <Empty>{queueView ? "The send queue is empty. Tick orders on the Shopify orders page and click Create POs." : "No purchase orders here."}</Empty>}
      </div>
      {open ? <BatchEmail pos={chosen} email={email} onClose={() => setOpen(false)} onDone={(t) => { setOpen(false); setMsg(t); setSel(new Set()); router.refresh(); }} /> : null}
    </>
  );
}
