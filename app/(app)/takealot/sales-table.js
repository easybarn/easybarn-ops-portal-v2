"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FilePlus2, ExternalLink } from "lucide-react";
import { Button, Empty, Notice, Badge, cx } from "@/components/ui";
import { ItemCode } from "../orders/order-bits";
import { zar, ago } from "@/lib/format";

const DC_TONE = { JHB: "warn", CPT: "info", DBN: "ok" };
export const DcBadge = ({ dc }) => (dc ? <Badge tone={DC_TONE[dc] || "neutral"}>{dc}</Badge> : <span className="text-faint">—</span>);

function statusTone(st) {
  const s = String(st || "").toLowerCase();
  if (s.includes("cancel") || s.includes("return")) return "bad";
  if (s.includes("shipped to customer") || s.includes("delivered")) return "ok";
  if (s.includes("new")) return "warn";
  return "info";
}

export default function SalesTable({ sales, tab, isAdmin }) {
  const router = useRouter();
  const [sel, setSel] = useState(() => new Set());
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  const selectable = (s) => !s.po && s.tab !== "cancelled";
  const pickable = sales.filter(selectable);
  const canSelect = tab !== "cancelled" && pickable.length > 0;
  const allOn = canSelect && pickable.every((s) => sel.has(s.key));
  const toggle = (k) => setSel((x) => { const n = new Set(x); n.has(k) ? n.delete(k) : n.add(k); return n; });
  const unmapped = sales.filter((s) => s.sku && !s.product).length;

  async function raise() {
    setBusy(true); setResult(null);
    const r = await fetch("/api/takealot/purchase-orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ keys: [...sel] }) });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return setResult({ tone: "bad", text: d.error || "Couldn't raise POs" });
    const failed = d.results.filter((x) => !x.ok);
    setResult({ tone: failed.length ? "warn" : "ok", text: `Raised ${d.created} PO${d.created === 1 ? "" : "s"} (${d.results.filter((x) => x.ok).map((x) => x.po_number).join(", ") || "none"}).` + (failed.length ? ` Skipped: ${failed.map((x) => `${x.name || x.key} – ${x.error}`).join("; ")}` : "") });
    setSel(new Set()); router.refresh();
  }

  return (
    <>
      {result ? <div className="mb-2"><Notice tone={result.tone}>{result.text} <Link href="/purchase-orders?status=draft" className="underline font-medium">Email them from the send queue →</Link></Notice></div> : null}
      {sel.size ? (
        <div className="mb-2 flex flex-wrap items-center gap-2 px-3 py-2 rounded-md border border-accent bg-accent-soft">
          <b>{sel.size} selected</b>
          <Button size="sm" variant="primary" onClick={raise} disabled={busy}><FilePlus2 size={13} /> {busy ? "Raising…" : `Raise ${sel.size} PO${sel.size === 1 ? "" : "s"} on Panel & Pane`}</Button>
          <Button size="sm" variant="ghost" onClick={() => setSel(new Set())} disabled={busy}>Clear</Button>
        </div>
      ) : null}

      <div className="bg-panel border border-line rounded-md">
        {sales.length ? (
          <div className="overflow-auto max-h-[calc(100vh-230px)]">
            <table className="tbl">
              <thead>
                <tr>
                  {canSelect ? <th className="w-8"><input type="checkbox" aria-label="Select all" checked={allOn} onChange={() => setSel(allOn ? new Set() : new Set(pickable.map((s) => s.key)))} /></th> : null}
                  <th>Order</th><th>Customer · DC</th><th>Item · P&amp;P code</th><th>Takealot status</th><th>Shipment</th><th>PO</th>
                  {isAdmin ? <th className="r">Sale</th> : null}
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {sales.map((s) => (
                  <tr key={s.key} className={cx(sel.has(s.key) && "[&>td]:!bg-accent-soft")}>
                    {canSelect ? <td className="align-top">{selectable(s) ? <input type="checkbox" aria-label={`Select ${s.name}`} checked={sel.has(s.key)} onChange={() => toggle(s.key)} /> : null}</td> : null}
                    <td className="align-top whitespace-nowrap">
                      <div className="num font-semibold">{s.name}</div>
                      <div className={cx("text-[11px]", s.tab === "new" && s.ageDays > 3 ? "text-bad font-medium" : "text-faint")}>{s.createdAt ? ago(s.createdAt) : "—"} · <span className="num">#{s.key}</span></div>
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
                    <td className="align-top whitespace-nowrap">
                      {s.po ? <Link href={`/purchase-orders/${s.po.id}`}><Badge tone="accent">{s.po.po_number} · {s.po.status}</Badge></Link> : <span className="text-faint text-[11px]">none</span>}
                    </td>
                    {isAdmin ? <td className="align-top r num whitespace-nowrap">{zar(s.total)}</td> : null}
                    <td className="align-top r">{s.url ? <a href={s.url} target="_blank" rel="noreferrer" className="text-faint hover:text-accent" title="View on Takealot"><ExternalLink size={13} /></a> : null}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <Empty>{{ new: "No new Takealot sales waiting for a PO.", po: "Nothing waiting to be delivered to Takealot.", atdc: "Nothing at the Takealot DC right now.", done: "No delivered sales in this period.", cancelled: "No cancelled sales in this period.", search: "No matches." }[tab]}</Empty>}
        <div className="px-3 h-9 flex items-center gap-3 text-[11px] text-faint border-t border-line">
          <span><span className="num">{sales.length}</span> sales</span>
          {unmapped ? <span className="text-bad">{unmapped} with unmapped SKUs</span> : null}
          {tab === "new" ? <span>Tick sales and raise POs on Panel &amp; Pane.</span> : null}
          {tab === "po" ? <span>Next: confirm the shipment in the seller portal, then open it here to print the pack.</span> : null}
        </div>
      </div>
    </>
  );
}
