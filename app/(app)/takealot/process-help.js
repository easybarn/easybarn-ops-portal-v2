"use client";

import ProcessDialog from "@/components/process-dialog";

const STEPS = [
  ["1 · Sale comes in", "A customer buys on Takealot and the sale appears under Lead-time sales as a new lead-time order. Takealot adds it to a draft shipment for that DC (JHB, CPT or DBN), with a due date.", "Lead-time sales"],
  ["2 · Stock from Panel & Pane (if needed)", "If the door has to come from Panel & Pane, click Create PO on the sale. The PO goes into the send queue; email it from Purchase orders → Send queue.", "Lead-time sales · Purchase orders"],
  ["3 · Confirm the shipment", "In the Takealot seller portal, check the draft shipment (quantities, boxes) and confirm it. Takealot then gives it a PO number.", "Takealot seller portal"],
  ["4 · Print the pack", "Open the shipment here and print: the shipping note (goes inside the box), one shipping label per box, and one product label per unit. Print at 100% scale, not “fit to page”. Use “labels used on sheet” for part-used label sheets.", "Shipments → shipment"],
  ["5 · Pack and deliver", "Label each unit and box, put the shipping note inside, and get it to the Takealot DC before the due date.", "Warehouse"],
  ["6 · Takealot takes over", "Once Takealot receives it the sale shows Preparing for Customer, then Shipped to Customer. Late deliveries can be cancelled by Takealot (Cancelled - Late Delivery).", "Lead-time sales"],
];

export default function TakealotProcess() {
  return (
    <ProcessDialog
      title="Takealot lead-time process"
      flow="sale → (PO) → confirm shipment → print pack → deliver to DC"
      intro="Takealot runs the booking. Shipments are created and confirmed in the Takealot seller portal; this portal shows the sales and shipments and prints the documents."
      steps={STEPS}
      footer={<>Statuses come straight from Takealot: Draft Shipment → Preparing for Customer → Shipped to Customer. Takealot sales are not put on picking slips.</>}
    />
  );
}
