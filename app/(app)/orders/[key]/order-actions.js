"use client";

import { useState } from "react";
import { Truck, ExternalLink, FileText, Tag } from "lucide-react";
import { Button, Badge, cx } from "@/components/ui";
import ShipDialog from "@/components/ship-dialog";
import RefreshButton from "@/components/refresh-button";
import CreatePoButton from "@/components/create-po-button";
import Link from "next/link";
import { shortDate } from "@/lib/format";

const STORE_ADMIN = "https://admin.shopify.com/store/4e1d7d-2/orders/";

export default function OrderActions({ order }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <RefreshButton />
      <a href={STORE_ADMIN + order.id.split("/").pop()} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 h-[30px] px-3 rounded-[5px] border border-line-strong bg-panel hover:bg-hover font-medium">
        <ExternalLink size={13} /> Shopify
      </a>
      {order.po ? (
        <Link href={`/purchase-orders/${order.po.id}`} className="inline-flex items-center gap-1.5 h-[30px] px-3 rounded-[5px] border border-line-strong bg-panel hover:bg-hover font-medium num">{order.po.po_number}</Link>
      ) : order.cancelled ? null : <CreatePoButton orderKey={order.key} />}
      <Button variant={order.tracking.length ? "default" : "primary"} onClick={() => setOpen(true)} disabled={!order.address || order.cancelled}>
        <Truck size={14} /> {order.tracking.length ? "Ship more" : "Ship with TCG"}
      </Button>
      {open ? <ShipDialog order={order} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

export function TrackingRow({ t }) {
  const [slot, setSlot] = useState(1);
  const tcg = /courier guy/i.test(t.company || "");
  return (
    <tr>
      <td>{t.url ? <a href={t.url} target="_blank" rel="noreferrer" className="num font-semibold hover:text-accent">{t.number}</a> : <span className="num font-semibold">{t.number}</span>}</td>
      <td className="text-muted">{t.company || "—"}</td>
      <td><Badge tone={t.status === "SUCCESS" ? "ok" : "neutral"}>{String(t.status || "").toLowerCase()}</Badge></td>
      <td className="text-muted">{shortDate(t.at)}</td>
      <td className="r whitespace-nowrap">
        {tcg ? (
          <span className="inline-flex items-center gap-1">
            <a className="inline-flex items-center gap-1 h-[26px] px-2 rounded border border-line-strong hover:bg-hover text-[12px]" href={`/api/courier/waybill?ref=${encodeURIComponent(t.number)}`} target="_blank" rel="noreferrer"><FileText size={12} /> Waybill</a>
            <select aria-label="Sticker start slot" className="input !h-[26px] !w-[52px] text-[12px]" value={slot} onChange={(e) => setSlot(e.target.value)}>
              {[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            <a className={cx("inline-flex items-center gap-1 h-[26px] px-2 rounded border border-line-strong hover:bg-hover text-[12px]")} href={`/api/courier/stickers?refs=${encodeURIComponent(t.number)}&startSlot=${slot}`} target="_blank" rel="noreferrer"><Tag size={12} /> Stickers</a>
          </span>
        ) : <span className="text-faint text-[11px]">—</span>}
      </td>
    </tr>
  );
}
