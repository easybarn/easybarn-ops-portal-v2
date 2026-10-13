"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Printer, Truck, X, Check, AlertTriangle } from "lucide-react";
import { PageHeader, Panel, Button, Badge, Notice, btnClass, cx } from "@/components/ui";
import ShipDialog from "@/components/ship-dialog";
import RefreshButton from "@/components/refresh-button";
import { ItemCode } from "../../orders/order-bits";
import { shortDate } from "@/lib/format";

const OPEN = ["created", "draft", "picking"];

export default function SlipView({ data }) {
  const router = useRouter();
  const { slip, orders, pickList, progress, missing, otherMarketplace } = data;
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [ship, setShip] = useState(null);
  const open = OPEN.includes(slip.status);
  const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;

  async function call(url, body, method = "POST") {
    setBusy(true); setMsg(null);
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setMsg({ tone: "bad", text: d.error || "Something went wrong" }); return false; }
    router.refresh();
    return true;
  }
  const tick = (keys, tickName, value) => call(`/api/slips/${slip.id}/tick`, { keys, tick: tickName, value });
  const status = (s, confirmText) => { if (confirmText && !window.confirm(confirmText)) return; call(`/api/slips/${slip.id}`, { status: s }, "PATCH"); };
  const remove = (o) => { if (window.confirm(`Take ${o.name} off ${slip.slip_number}? It goes back to “PO raised”.`)) call(`/api/slips/${slip.id}/remove`, { orderKey: o.key }); };

  return (
    <div>
      <PageHeader
        crumbs={[{ label: "Picking slips", href: "/picking-slips" }, { label: slip.slip_number }]}
        title={<span className="flex items-center gap-2"><span className="num">{slip.slip_number}</span><Badge tone={open ? "warn" : slip.status === "complete" ? "ok" : slip.status === "cancelled" ? "neutral" : "info"}>{open ? "picking" : slip.status}</Badge></span>}
        sub={`Created ${shortDate(slip.created_at)} · ${orders.length} orders · ${progress.done}/${progress.total} lines picked${progress.issues ? ` · ${progress.issues} stock issue${progress.issues > 1 ? "s" : ""}` : ""}`}
        actions={
          <>
            <RefreshButton />
            <a href={`/print/slip/${slip.id}`} target="_blank" rel="noreferrer" className={btnClass()}><Printer size={14} /> Print slip</a>
            {open ? <Button variant="primary" onClick={() => status("picked", progress.done < progress.total ? `Only ${progress.done} of ${progress.total} lines are ticked. Mark the whole slip picked anyway?` : null)} disabled={busy}><Check size={14} /> Mark picked</Button> : null}
            {slip.status === "picked" ? <Button onClick={() => status("complete")} disabled={busy}>Complete slip</Button> : null}
            {!open && slip.status !== "cancelled" ? <Button variant="ghost" onClick={() => status("picking")} disabled={busy}>Reopen</Button> : null}
            {slip.status !== "cancelled" && slip.status !== "complete" ? <Button variant="danger" onClick={() => status("cancelled", `Cancel ${slip.slip_number}? Its orders go back to “PO raised”.`)} disabled={busy}>Cancel</Button> : null}
          </>
        }
      />
      <div className="h-1.5 rounded bg-sunk mb-3 overflow-hidden"><div className="h-full bg-ok" style={{ width: `${pct}%` }} /></div>
      {msg ? <div className="mb-3"><Notice tone={msg.tone}>{msg.text}</Notice></div> : null}
      {missing.length ? <div className="mb-3"><Notice tone="warn">Couldn&apos;t find in Shopify: {missing.map((k) => "#" + k).join(", ")}</Notice></div> : null}
      {otherMarketplace.length ? <div className="mb-3"><Notice tone="info">Also on this slip from the old portal: {otherMarketplace.map((r) => `${r.marketplace} ${r.order_id}`).join(", ")}</Notice></div> : null}

      <div className="grid xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-3 items-start">
        <Panel title="Pick list · by P&P code" pad={false}>
          <table className="tbl">
            <thead><tr><th className="w-8">✓</th><th className="r">Qty</th><th>Code</th><th>Description</th><th>Orders</th></tr></thead>
            <tbody>
              {pickList.map((g) => {
                const all = g.picked === g.keys.length;
                return (
                  <tr key={g.code} className={cx(all && "opacity-55")}>
                    <td><input type="checkbox" aria-label={`Picked all ${g.code}`} checked={all} disabled={busy || !open} onChange={() => tick(g.keys, "picked", !all)} /></td>
                    <td className="r num font-semibold text-[14px]">{g.qty}</td>
                    <td className="num font-semibold whitespace-nowrap">{g.mapped ? g.code : <span className={g.code === "PURPOSE MADE" ? "text-info" : "text-bad"}>{g.code}</span>}</td>
                    <td><div className="max-w-[260px] truncate" title={g.description}>{g.description}</div>{g.size ? <div className="text-[11px] text-faint num">{g.size}</div> : null}</td>
                    <td className="text-[11px] text-muted num">{g.orders.join(", ")}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="px-3 py-2 text-[11px] text-faint border-t border-line">Ticking a code ticks that item on every order below.</p>
        </Panel>

        <div className="grid gap-3">
          {orders.map((o) => (
            <section key={o.key} className={cx("bg-panel border rounded-md", o.allPicked ? "border-ok" : "border-line")}>
              <div className="flex flex-wrap items-center gap-2 px-3 h-10 border-b border-line">
                <Link href={`/orders/${o.key}`} className="num font-semibold hover:text-accent">{o.name}</Link>
                <span className="text-muted truncate max-w-[200px]">{o.customer.name}</span>
                <span className="text-[11px] text-faint">{[o.address?.city, o.address?.provinceCode].filter(Boolean).join(", ")}</span>
                {o.po ? <Link href={`/purchase-orders/${o.po.id}`}><Badge tone="accent">{o.po.po_number}</Badge></Link> : <Badge tone="bad">no PO</Badge>}
                {o.tracking.length ? <Badge tone="ok">shipped {o.tracking[0].number}</Badge> : o.allPicked ? <Badge tone="ok"><Check size={10} /> picked</Badge> : null}
                <span className="ml-auto flex gap-1">
                  {!o.tracking.length ? <Button size="sm" variant={o.allPicked ? "primary" : "default"} onClick={() => setShip(o)} disabled={!o.address}><Truck size={12} /> Ship</Button> : null}
                  {open ? <button className="p-1 text-faint hover:text-bad" onClick={() => remove(o)} aria-label={`Remove ${o.name}`} title="Take off this slip"><X size={14} /></button> : null}
                </span>
              </div>
              <table className="tbl">
                <tbody>
                  {o.items.map((i) => (
                    <tr key={i.key} className={cx(i.picked && "opacity-55")}>
                      <td className="w-8"><input type="checkbox" aria-label={`Picked ${i.title}`} checked={i.picked} disabled={busy || !open} onChange={() => tick([i.key], "picked", !i.picked)} /></td>
                      <td className="r num w-10">{i.qty}×</td>
                      <td className="whitespace-nowrap"><ItemCode item={i} /></td>
                      <td>{i.title}{i.variant ? <span className="text-faint"> · {i.variant}</span> : null}{i.props?.length ? <div className="text-[11px] text-muted">{i.props.map((p) => `${p.key}: ${p.value}`).join(" · ")}</div> : null}</td>
                      <td className="r whitespace-nowrap">
                        <button disabled={busy || !open} onClick={() => tick([i.key], "stock_issue", !i.stockIssue)} className={cx("inline-flex items-center gap-1 h-6 px-1.5 rounded text-[11px] border", i.stockIssue ? "bg-bad-soft text-bad border-transparent font-semibold" : "border-line text-faint hover:text-bad")} title="Flag short or damaged stock">
                          <AlertTriangle size={11} /> {i.stockIssue ? "stock issue" : "issue"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {o.note ? <div className="px-3 py-1.5 text-[12px] bg-sunk border-t border-line"><b>Note:</b> {o.note}</div> : null}
            </section>
          ))}
        </div>
      </div>
      {ship ? <ShipDialog order={ship} onClose={() => setShip(null)} /> : null}
    </div>
  );
}
