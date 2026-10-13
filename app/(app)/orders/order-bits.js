"use client";

import Link from "next/link";
import { Badge } from "@/components/ui";
import CreatePoButton from "@/components/create-po-button";


export function PayBadge({ status }) {
  const s = String(status || "").toUpperCase();
  const tone = s === "PAID" ? "ok" : s.includes("PARTIAL") ? "warn" : s.includes("REFUND") || s === "VOIDED" ? "bad" : "warn";
  return <Badge tone={tone}>{s.replace(/_/g, " ").toLowerCase() || "—"}</Badge>;
}

export function ItemCode({ item }) {
  if (item.product) {
    return (
      <Link href={`/products/${encodeURIComponent(item.product.code)}`} className="num text-[11px] font-semibold px-1 rounded bg-sunk hover:text-accent" title={item.product.description} onClick={(e) => e.stopPropagation()}>
        {item.product.code}
      </Link>
    );
  }
  if (!item.sku) return <span className="text-[10.5px] text-faint">no SKU</span>;
  return <Link href="/products/unmapped" className="num text-[11px] px-1 rounded bg-bad-soft text-bad" title="SKU not mapped to a product" onClick={(e) => e.stopPropagation()}>{item.sku} ?</Link>;
}

export function Pipeline({ order, canCreate = false }) {
  return (
    <span className="inline-flex flex-wrap gap-1">
      {order.slip ? <Link href={`/picking-slips/${order.slip.id}`} onClick={(e) => e.stopPropagation()}><Badge tone={order.slip.picked ? "ok" : "info"}>{order.slip.number || "slip"} · {order.slip.status}</Badge></Link> : null}
      {order.po ? <Link href={`/purchase-orders/${order.po.id}`} onClick={(e) => e.stopPropagation()}><Badge tone="accent">{order.po.po_number} · {order.po.status}</Badge></Link> : canCreate ? <CreatePoButton orderKey={order.key} size="sm" compact /> : null}
      {!order.slip && !order.po && !canCreate ? <span className="text-faint text-[11px]">—</span> : null}
    </span>
  );
}
