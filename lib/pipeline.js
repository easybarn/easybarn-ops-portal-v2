// Shopify order pipeline: New → PO raised → On slip → Ready to ship → Shipped
export const STAGES = [
  { key: "new", label: "1 · New", hint: "No PO yet" },
  { key: "pick", label: "2 · PO raised", hint: "Ready to add to a picking slip" },
  { key: "slip", label: "3 · On slip", hint: "Being picked" },
  { key: "ship", label: "4 · Ready to ship", hint: "Picked, book the courier" },
];

export function stageOf(o) {
  if (o.tracking?.length) return "shipped";
  if (o.slip?.picked) return "ship";
  if (o.slip) return "slip";
  if (o.po) return "pick";
  return "new";
}
