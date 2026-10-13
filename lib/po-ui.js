export const PO_TONE = { draft: "warn", sent: "info", complete: "ok", cancelled: "neutral" };

// Where a PO's source order lives in the portal
export function sourceHref(po) {
  if (!po?.source_order_id) return null;
  if (po.source_marketplace === "shopify") return `/orders/${po.source_order_id}`;
  if (po.source_marketplace === "takealot") return `/takealot?q=${encodeURIComponent(po.source_order_id)}`;
  return null;
}
