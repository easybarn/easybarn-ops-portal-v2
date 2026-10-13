"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Truck, FilePlus2, ClipboardList, Check } from "lucide-react";
import { Button, Empty, Notice, Badge, cx } from "@/components/ui";
import ShipDialog from "@/components/ship-dialog";
import { zar, ago } from "@/lib/format";
import { PayBadge, ItemCode, Pipeline } from "./order-bits";

const post = (url, body) => fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(async (r) => ({ ok: r.ok, d: await r.json().catch(() => ({})) }));

export default function OrdersTable({ orders, tab, openSlips = [], nextHref, firstHref }) {
  const router = useRouter();
  const [ship, setShip] = useState(null);
  const [sel, setSel] = useState(() => new Set());
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [slipTarget, setSlipTarget] = useState("new");

  // Which orders can be ticked depends on the stage
  const selectable = (o) => !o.cancelled && (tab === "new" ? !o.po : tab === "pick" ? !o.slip : false);
  const pickable = orders.filter(selectable);
  const canSelect = pickable.length > 0;
  const allOn = canSelect && pickable.every((o) => sel.has(o.key));
  const toggle = (k) => setSel((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });
  const unmapped = orders.filter((o) => o.items.some((i) => i.sku && !i.product)).length;

  async function raisePos() {
    setBusy(true); setResult(null);
    const { ok, d } = await post("/api/purchase-orders/bulk", { orderKeys: [...sel] });
    setBusy(false);
    if (!ok) return setResult({ tone: "bad", text: d.error || "Couldn't create POs" });
    const failed = d.results.filter((r) => !r.ok);
    setResult({ tone: failed.length ? "warn" : "ok", text: `Raised ${d.created} PO${d.created === 1 ? "" : "s"} (${d.results.filter((r) => r.ok).map((r) => r.po_number).join(", ") || "none"}). Orders moved to “PO raised”.` + (failed.length ? ` Skipped: ${failed.map((r) => `#${r.key} – ${r.error}`).join("; ")}` : ""), link: ["/purchase-orders?status=draft", "Email them from the send queue →"] });
    setSel(new Set()); router.refresh();
  }

  async function toSlip() {
    setBusy(true); setResult(null);
    const { ok, d } = slipTarget === "new" ? await post("/api/slips", { orderKeys: [...sel] }) : await post(`/api/slips/${slipTarget}/add`, { orderKeys: [...sel] });
    setBusy(false);
    if (!ok) return setResult({ tone: "bad", text: d.error || "Couldn't update the picking slip" });
    setResult({ tone: "ok", text: `${sel.size} order${sel.size === 1 ? "" : "s"} on ${d.slip.slip_number}. Orders moved to “On slip”.`, link: [`/picking-slips/${d.slip.id}`, `Open ${d.slip.slip_number} →`] });
    setSel(new Set()); router.refresh();
  }

  return (
    <>
      {result ? <div className="mb-2"><Notice tone={result.tone}>{result.text} {result.link ? <Link href={result.link[0]} className="underline font-medium">{result.link[1]}</Link> : null}</Notice></div> : null}
      {sel.size ? (
        <div className="mb-2 flex flex-wrap items-center gap-2 px-3 py-2 rounded-md border border-accent bg-accent-soft">
          <b>{sel.size} selected</b>
          {tab === "new" ? (
            <Button size="sm" variant="primary" onClick={raisePos} disabled={busy}><FilePlus2 size={13} /> {busy ? "Raising…" : `Raise ${sel.size} PO${sel.size === 1 ? "" : "s"} on Panel & Pane`}</Button>
          ) : null}
          {tab === "pick" ? (
            <>
              <select className="input !h-[26px] !w-auto text-[12px]" value={slipTarget} onChange={(e) => setSlipTarget(e.target.value)} aria-label="Picking slip">
                <option value="new">New picking slip</option>
                {openSlips.map((s) => <option key={s.id} value={s.id}>Add to {s.number} ({s.count} orders)</option>)}
              </select>
              <Button size="sm" variant="primary" onClick={toSlip} disabled={busy}><ClipboardList size={13} /> {busy ? "Working…" : slipTarget === "new" ? "Create picking slip" : "Add to slip"}</Button>
            </>
          ) : null}
          <Button size="sm" variant="ghost" onClick={() => setSel(new Set())} disabled={busy}>Clear</Button>
        </div>
      ) : null}

      <div className="bg-panel border border-line rounded-md">
        {orders.length ? (
          <div className="overflow-auto max-h-[calc(100vh-240px)]">
            <table className="tbl">
              <thead>
                <tr>
                  {canSelect ? <th className="w-8"><input type="checkbox" aria-label="Select all" checked={allOn} onChange={() => setSel(allOn ? new Set() : new Set(pickable.map((o) => o.key)))} /></th> : null}
                  <th>Order</th><th>Customer</th><th>Items · P&amp;P code</th><th>PO · slip</th><th>Payment</th><th className="r">Total</th>
                  {tab === "shipped" ? <th>Tracking</th> : null}
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} className={cx("cursor-pointer", sel.has(o.key) && "[&>td]:!bg-accent-soft")} onClick={() => router.push(`/orders/${o.key}`)}>
                    {canSelect ? (
                      <td className="align-top" onClick={(e) => e.stopPropagation()}>
                        {selectable(o) ? <input type="checkbox" aria-label={`Select ${o.name}`} checked={sel.has(o.key)} onChange={() => toggle(o.key)} /> : null}
                      </td>
                    ) : null}
                    <td className="whitespace-nowrap align-top">
                      <Link href={`/orders/${o.key}`} className="num font-semibold hover:text-accent" onClick={(e) => e.stopPropagation()}>{o.name}</Link>
                      <div className={cx("text-[11px]", tab !== "shipped" && o.ageDays > 5 ? "text-bad font-medium" : "text-faint")}>{ago(o.createdAt)}</div>
                    </td>
                    <td className="align-top min-w-[150px]">
                      <div className="truncate max-w-[200px]">{o.customer.name}</div>
                      <div className="text-[11px] text-faint">{[o.address?.city, o.address?.provinceCode].filter(Boolean).join(", ") || "No address"}</div>
                    </td>
                    <td className="align-top min-w-[280px]">
                      {o.items.map((i) => (
                        <div key={i.id} className="flex items-center gap-1.5 leading-5">
                          <span className="num text-muted w-6 text-right shrink-0">{i.qty}×</span>
                          <ItemCode item={i} />
                          <span className="truncate max-w-[260px]" title={i.title + (i.variant ? " · " + i.variant : "")}>{i.title}{i.variant ? <span className="text-faint"> · {i.variant}</span> : null}</span>
                        </div>
                      ))}
                    </td>
                    <td className="align-top">
                      {o.po ? <div className="mb-0.5"><Badge tone="ok"><Check size={10} /> PO raised</Badge>{o.autoPo ? <Badge className="ml-1">auto</Badge> : null}</div> : null}
                      <Pipeline order={o} canCreate={tab === "new"} />
                      {o.slip?.picked ? <div className="mt-0.5"><Badge tone="ok"><Check size={10} /> picked</Badge></div> : null}
                    </td>
                    <td className="align-top"><PayBadge status={o.financial} /></td>
                    <td className="align-top r num whitespace-nowrap">{zar(o.total)}</td>
                    {tab === "shipped" ? (
                      <td className="align-top whitespace-nowrap">
                        {o.tracking.length ? o.tracking.map((t) => (
                          <a key={t.number} href={t.url || "#"} target="_blank" rel="noreferrer" className="num block text-[12px] hover:text-accent" onClick={(e) => e.stopPropagation()}>{t.number}</a>
                        )) : <span className="text-faint text-[11px]">no tracking</span>}
                      </td>
                    ) : null}
                    <td className="align-top r whitespace-nowrap">
                      {tab === "ship" || tab === "slip" ? (
                        <Button size="sm" variant={tab === "ship" ? "primary" : "default"} onClick={(e) => { e.stopPropagation(); setShip(o); }} disabled={!o.address}>
                          <Truck size={13} /> Ship
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <Empty>{{ new: "No new orders without a PO.", pick: "Nothing waiting for a picking slip.", slip: "No orders on open picking slips.", ship: "Nothing picked and waiting to ship.", shipped: "No shipped orders." }[tab]}</Empty>}
        <div className="px-3 h-9 flex items-center gap-3 text-[11px] text-faint border-t border-line">
          <span><span className="num">{orders.length}</span> orders</span>
          {unmapped ? <span className="text-bad">{unmapped} with unmapped SKUs</span> : null}
          {tab === "new" ? <span>New paid orders get a PO automatically; older ones can be ticked and raised here.</span> : null}
          {tab === "pick" ? <span>Tick orders and create a picking slip.</span> : null}
          <span className="ml-auto flex gap-3">
            {firstHref ? <Link href={firstHref} className="text-accent hover:underline">← Newest</Link> : null}
            {nextHref ? <Link href={nextHref} className="text-accent hover:underline">Older →</Link> : null}
          </span>
        </div>
      </div>
      {ship ? <ShipDialog order={ship} onClose={() => setShip(null)} /> : null}
    </>
  );
}
