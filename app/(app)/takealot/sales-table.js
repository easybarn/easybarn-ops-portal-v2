"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FilePlus2, ExternalLink } from "lucide-react";
import { Button, Empty, Notice, Badge } from "@/components/ui";
import { ItemCode } from "../orders/order-bits";
import { zar, ago } from "@/lib/format";

const DC_TONE = { JHB: "warn", CPT: "info", DBN: "ok" };
export const DcBadge = ({ dc }) => (dc ? <Badge tone={DC_TONE[dc] || "neutral"}>{dc}</Badge> : <span className="text-faint">—</span>);

export function statusTone(st) {
  const s = String(st || "").toLowerCase();
  if (s.includes("cancel") || s.includes("return")) return "bad";
  if (s.includes("shipped to customer") || s.includes("delivered")) return "ok";
  if (s.includes("new") || s.includes("draft")) return "warn";
  return "info";
}

function PoCell({ sale, onDone }) {
  const [busy, setBusy] = useState(false);
  if (sale.po) return <Link href={`/purchase-orders/${sale.po.id}`}><Badge tone="accent">{sale.po.po_number} · {sale.po.status}</Badge></Link>;
  async function create() {
    setBusy(true);
    const r = await fetch("/api/takealot/purchase-orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ keys: [sale.key] }) });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    const x = d.results?.[0];
    onDone(r.ok && x?.ok ? { tone: "ok", text: `${x.po_number} raised for ${sale.name}.` } : { tone: "bad", text: x?.error || d.error || "Couldn't create PO" });
  }
  return <Button size="sm" onClick={create} disabled={busy}><FilePlus2 size={12} /> {busy ? "Creating…" : "Create PO"}</Button>;
}

export default function SalesTable({ sales, isAdmin }) {
  const router = useRouter();
  const [msg, setMsg] = useState(null);
  const unmapped = sales.filter((s) => s.sku && !s.product).length;
  const done = (m) => { setMsg(m); router.refresh(); };

  return (
    <>
      {msg ? <div className="mb-2"><Notice tone={msg.tone}>{msg.text} {msg.tone === "ok" ? <Link href="/purchase-orders?status=draft" className="underline font-medium">Send queue →</Link> : null}</Notice></div> : null}
      <div className="bg-panel border border-line rounded-md">
        {sales.length ? (
          <div className="overflow-auto max-h-[calc(100vh-230px)]">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Order</th><th>Customer · DC</th><th>Item · P&amp;P code</th><th>Takealot status</th><th>Shipment</th>
                  {isAdmin ? <th className="r">Sale</th> : null}
                  <th>PO</th><th></th>
                </tr>
              </thead>
              <tbody>
                {sales.map((s) => (
                  <tr key={s.key}>
                    <td className="align-top whitespace-nowrap">
                      <div className="num font-semibold">{s.name}</div>
                      <div className="text-[11px] text-faint">{s.createdAt ? ago(s.createdAt) : "—"} · <span className="num">#{s.key}</span></div>
                    </td>
                    <td className="align-top"><div className="truncate max-w-[170px]">{s.customer}</div><div className="mt-0.5"><DcBadge dc={s.dc} /></div></td>
                    <td className="align-top min-w-[260px]">
                      <div className="flex items-center gap-1.5 leading-5">
                        <span className="num text-muted w-6 text-right shrink-0">{s.qty}×</span>
                        <ItemCode item={s} />
                        <span className="truncate max-w-[260px]" title={s.title}>{s.title}</span>
                      </div>
                      {s.product?.size ? <div className="pl-8 text-[11px] text-faint num">{s.product.size}</div> : null}
                    </td>
                    <td className="align-top"><Badge tone={statusTone(s.status)}>{s.status || "—"}</Badge></td>
                    <td className="align-top whitespace-nowrap">
                      {s.shipmentId ? <Link href={`/takealot/shipments/${s.shipmentId}`} className="num text-[12px] hover:text-accent">{s.shipmentName || s.shipmentId}</Link> : <span className="text-faint text-[11px]">—</span>}
                      {s.poNumber ? <div className="text-[11px] text-faint num">TAL PO {s.poNumber}</div> : null}
                    </td>
                    {isAdmin ? <td className="align-top r num whitespace-nowrap">{zar(s.total)}</td> : null}
                    <td className="align-top whitespace-nowrap"><PoCell sale={s} onDone={done} /></td>
                    <td className="align-top r">{s.url ? <a href={s.url} target="_blank" rel="noreferrer" className="text-faint hover:text-accent" title="View on Takealot"><ExternalLink size={13} /></a> : null}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <Empty>No Takealot sales match.</Empty>}
        <div className="px-3 h-9 flex items-center gap-3 text-[11px] text-faint border-t border-line">
          <span><span className="num">{sales.length}</span> sale{sales.length === 1 ? "" : "s"}</span>
          {unmapped ? <span className="text-bad">{unmapped} with unmapped SKUs</span> : null}
        </div>
      </div>
    </>
  );
}
