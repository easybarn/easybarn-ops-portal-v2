"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FilePlus2, ExternalLink, Truck, Check } from "lucide-react";
import { Button, Empty, Notice, Badge, cx } from "@/components/ui";
import ShipDialog from "@/components/ship-dialog";
import { ItemCode } from "../orders/order-bits";
import { zar, ago, shortDate } from "@/lib/format";

const TONE = { WAITING_ACCEPTANCE: "bad", SHIPPING: "warn", SHIPPED: "info", TO_COLLECT: "info", RECEIVED: "ok", CLOSED: "ok", REFUSED: "neutral", CANCELED: "neutral", REFUNDED: "neutral" };
const CAN_SHIP = ["SHIPPING"];

function PoCell({ order, onDone }) {
  const [busy, setBusy] = useState(false);
  if (order.po) return <Link href={`/purchase-orders/${order.po.id}`}><Badge tone="accent">{order.po.po_number} · {order.po.status}</Badge></Link>;
  async function create() {
    setBusy(true);
    const r = await fetch("/api/leroymerlin/purchase-orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: order.key }) });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    onDone(r.ok ? { tone: "ok", text: `${d.po_number} raised for ${order.name}.` } : { tone: "bad", text: d.error || "Couldn't create PO" });
  }
  return <Button size="sm" onClick={create} disabled={busy}><FilePlus2 size={12} /> {busy ? "Creating…" : "Create PO"}</Button>;
}

function AcceptButton({ order, onDone }) {
  const [busy, setBusy] = useState(false);
  async function accept() {
    if (!window.confirm(`Accept ${order.name} for ${order.customer.name}?\n\n${order.items.map((i) => `${i.qty}× ${i.product?.code || i.sku} ${i.title}`).join("\n")}\n\nLeroy Merlin will expect it shipped by ${order.shipBy ? new Date(order.shipBy).toLocaleDateString("en-ZA") : "the ship-by date"}.`)) return;
    setBusy(true);
    const r = await fetch("/api/leroymerlin/accept", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId: order.id }) });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    onDone(r.ok ? { tone: "ok", text: `${order.name} accepted. Leroy Merlin takes a moment to move it to Awaiting shipment; refresh in a minute, then Ship.`, plain: true } : { tone: "bad", text: d.error || "Couldn't accept the order" });
  }
  return <Button size="sm" variant="primary" onClick={accept} disabled={busy}><Check size={12} /> {busy ? "Accepting…" : "Accept"}</Button>;
}

export default function LmTable({ orders, isAdmin, tab }) {
  const router = useRouter();
  const [msg, setMsg] = useState(null);
  const [ship, setShip] = useState(null);
  const done = (m) => { setMsg(m); router.refresh(); };
  const unmapped = orders.filter((o) => o.items.some((i) => i.sku && !i.product)).length;
  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      {msg ? <div className="mb-2"><Notice tone={msg.tone}>{msg.text} {msg.tone === "ok" && !msg.plain ? <Link href="/purchase-orders?status=draft" className="underline font-medium">Send queue →</Link> : null}</Notice></div> : null}
      <div className="bg-panel border border-line rounded-md">
        {orders.length ? (
          <div className="overflow-auto max-h-[calc(100vh-230px)]">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Order</th><th>Customer · city</th><th>Items · P&amp;P code</th><th>LM status</th><th>Ship by</th>
                  {isAdmin ? <th className="r">Total</th> : null}
                  <th>PO</th><th></th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => {
                  const late = (CAN_SHIP.includes(o.state) || o.state === "WAITING_ACCEPTANCE") && o.shipBy && o.shipBy.slice(0, 10) < today;
                  return (
                    <tr key={o.id}>
                      <td className="align-top whitespace-nowrap">
                        <div className="num font-semibold">{o.id}</div>
                        <div className="text-[11px] text-faint">{ago(o.createdAt)}</div>
                      </td>
                      <td className="align-top"><div className="truncate max-w-[180px]">{o.customer.name}</div><div className="text-[11px] text-faint">{[o.address?.city, o.address?.province].filter(Boolean).join(", ") || "No address"}</div></td>
                      <td className="align-top min-w-[260px]">
                        {o.items.map((i) => (
                          <div key={i.id} className="flex items-center gap-1.5 leading-5">
                            <span className="num text-muted w-6 text-right shrink-0">{i.qty}×</span>
                            <ItemCode item={i} />
                            <span className="truncate max-w-[250px]" title={i.title}>{i.title}</span>
                          </div>
                        ))}
                      </td>
                      <td className="align-top"><Badge tone={TONE[o.state] || "neutral"}>{o.status}</Badge>{o.tracking[0] ? <div className="num text-[11px] text-faint mt-0.5">{o.tracking[0].number}</div> : null}</td>
                      <td className={cx("align-top whitespace-nowrap", late ? "text-bad font-medium" : "text-muted")}>{o.shipBy ? shortDate(o.shipBy) : "—"}{late ? <div className="text-[11px]">overdue</div> : null}</td>
                      {isAdmin ? <td className="align-top r num whitespace-nowrap">{zar(o.total)}</td> : null}
                      <td className="align-top whitespace-nowrap"><PoCell order={o} onDone={done} /></td>
                      <td className="align-top r whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5">
                          {o.state === "WAITING_ACCEPTANCE" ? <AcceptButton order={o} onDone={done} /> : null}
                          {CAN_SHIP.includes(o.state) ? <Button size="sm" variant="primary" onClick={() => setShip(o)} disabled={!o.address}><Truck size={12} /> Ship</Button> : null}
                          <a href={o.url} target="_blank" rel="noreferrer" className="text-faint hover:text-accent p-1" title="View in the LM portal"><ExternalLink size={13} /></a>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : <Empty>{{ action: "No new orders waiting to be accepted.", accepted: "Nothing accepted and waiting to ship.", shipped: "No shipped orders in this period.", done: "No completed orders in this period.", cancelled: "No cancelled orders in this period.", search: "No matches." }[tab]}</Empty>}
        <div className="px-3 h-9 flex items-center gap-3 text-[11px] text-faint border-t border-line">
          <span><span className="num">{orders.length}</span> order{orders.length === 1 ? "" : "s"}</span>
          {unmapped ? <span className="text-bad">{unmapped} with unmapped SKUs</span> : null}
          {tab === "action" ? <span>Accept new orders; they move to Accepted · awaiting shipment.</span> : null}
          {tab === "accepted" ? <span>Ship before the ship-by date. Tracking goes back to Leroy Merlin automatically.</span> : null}
        </div>
      </div>
      {ship ? <ShipDialog order={ship} marketplace="leroymerlin" onClose={() => { setShip(null); router.refresh(); }} /> : null}
    </>
  );
}
