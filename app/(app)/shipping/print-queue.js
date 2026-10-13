"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { FileText, Tag, Search } from "lucide-react";
import { Badge, Empty, btnClass, cx } from "@/components/ui";
import { zar, ago, shortDate } from "@/lib/format";

const tone = (s = "") => (/deliver/i.test(s) ? "ok" : /cancel|fail|exception/i.test(s) ? "bad" : /transit|collected|hub|branch/i.test(s) ? "info" : "warn");

export default function PrintQueue({ shipments }) {
  const [sel, setSel] = useState(() => new Set());
  const [q, setQ] = useState("");
  const [slot, setSlot] = useState(1);

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? shipments.filter((x) => [x.ref, x.customerRef, x.contact, x.city].some((v) => String(v || "").toLowerCase().includes(s))) : shipments;
  }, [shipments, q]);

  const chosen = shipments.filter((s) => sel.has(s.ref));
  const refs = chosen.map((s) => s.ref).join(",");
  const parcels = chosen.reduce((n, s) => n + s.parcels, 0);
  const allOn = rows.length > 0 && rows.every((r) => sel.has(r.ref));
  const toggle = (ref) => setSel((s) => { const n = new Set(s); n.has(ref) ? n.delete(ref) : n.add(ref); return n; });
  const orderKey = (ref) => (/^#?EASYBARN\d+/i.test(ref) ? ref.replace(/^#/, "") : null);

  return (
    <div className="bg-panel border border-line rounded-md">
      <div className="flex flex-wrap items-center gap-2 p-2 border-b border-line sticky top-0 bg-panel z-[2]">
        <div className="relative min-w-[220px] flex-1">
          <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-faint" />
          <input className="input !pl-7" placeholder="Filter waybill, order, name, city" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <span className="text-[12px] text-muted"><span className="num">{chosen.length}</span> selected · <span className="num">{parcels}</span> parcels</span>
        <a aria-disabled={!refs} className={cx(btnClass("primary"), !refs && "opacity-50 pointer-events-none")} href={`/api/courier/waybills?refs=${encodeURIComponent(refs)}`} target="_blank" rel="noreferrer"><FileText size={14} /> Print waybills</a>
        <span className="text-[12px] text-muted">start slot</span>
        <div className="inline-grid grid-cols-6 gap-1">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <button key={n} onClick={() => setSlot(n)} className={cx("w-7 h-7 rounded border num text-[12px]", slot === n ? "bg-accent-soft border-accent text-accent font-semibold" : "border-line text-muted")}>{n}</button>
          ))}
        </div>
        <a aria-disabled={!refs} className={cx(btnClass(), !refs && "opacity-50 pointer-events-none")} href={`/api/courier/stickers?refs=${encodeURIComponent(refs)}&startSlot=${slot}`} target="_blank" rel="noreferrer"><Tag size={14} /> Print stickers</a>
      </div>
      {rows.length ? (
        <div className="overflow-auto max-h-[calc(100vh-230px)]">
          <table className="tbl">
            <thead>
              <tr>
                <th className="w-8"><input type="checkbox" aria-label="Select all" checked={allOn} onChange={() => setSel((s) => { const n = new Set(s); rows.forEach((r) => (allOn ? n.delete(r.ref) : n.add(r.ref))); return n; })} /></th>
                <th>Waybill</th><th>Order ref</th><th>To</th><th>Route</th><th>Service</th><th className="r">Parcels</th><th>Status</th><th>Booked</th><th>Collect</th><th className="r">Charge</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id} className={cx("cursor-pointer", sel.has(s.ref) && "[&>td]:!bg-accent-soft")} onClick={() => toggle(s.ref)}>
                  <td><input type="checkbox" checked={sel.has(s.ref)} onChange={() => toggle(s.ref)} onClick={(e) => e.stopPropagation()} aria-label={`Select ${s.ref}`} /></td>
                  <td className="num font-semibold">{s.ref}</td>
                  <td>{orderKey(s.customerRef) ? <Link href={`/orders/${orderKey(s.customerRef)}`} className="num hover:text-accent" onClick={(e) => e.stopPropagation()}>{s.customerRef}</Link> : <span className="num text-muted">{s.customerRef || "—"}</span>}</td>
                  <td><div className="truncate max-w-[180px]">{s.contact}</div><div className="text-[11px] text-faint">{[s.city, s.zone].filter(Boolean).join(", ")}</div></td>
                  <td className="text-[12px] text-muted whitespace-nowrap">{s.from} → {s.to}</td>
                  <td className="num text-[12px]">{s.service}</td>
                  <td className="r num">{s.parcels}</td>
                  <td><Badge tone={tone(s.status)}>{String(s.status || "").replace(/-/g, " ")}</Badge></td>
                  <td className="text-muted whitespace-nowrap">{ago(s.createdAt)}</td>
                  <td className="text-muted whitespace-nowrap">{shortDate(s.collectionDate)}</td>
                  <td className="r num">{s.rate ? zar(s.rate) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <Empty>No shipments in this period.</Empty>}
    </div>
  );
}
