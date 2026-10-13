// Our process for a Takealot lead-time sale (client-safe)
export const TAL_STAGES = [
  { key: "new", label: "1 · New", hint: "Not in a shipment yet and no PO raised" },
  { key: "po", label: "2 · PO raised", hint: "PO raised on Panel & Pane; add it to a shipment in the Takealot seller portal" },
  { key: "shipment", label: "3 · In shipment", hint: "In a Takealot shipment; print the pack and deliver to the DC" },
];
export const TAL_OTHER = { done: "Delivered", cancelled: "Cancelled" };

export function talTab(s) {
  if (s.stage === "todo") return s.po ? "po" : "new";
  return s.stage;
}
