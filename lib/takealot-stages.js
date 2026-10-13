// Our process for a Takealot lead-time sale (client-safe)
export const TAL_STAGES = [
  { key: "new", label: "1 · New", hint: "Needs a PO on Panel & Pane" },
  { key: "po", label: "2 · To deliver", hint: "PO raised; confirm the shipment in the seller portal, print the pack and deliver to the DC" },
  { key: "atdc", label: "3 · At Takealot", hint: "Takealot has received the stock and is preparing it for the customer" },
];
export const TAL_OTHER = { done: "Delivered", cancelled: "Cancelled" };

export function talTab(s) {
  if (s.stage === "todo") return s.po ? "po" : "new";
  return s.stage;
}
