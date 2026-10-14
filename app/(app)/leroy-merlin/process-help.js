"use client";

import ProcessDialog from "@/components/process-dialog";

const STEPS = [
  ["Need action", "A new Leroy Merlin order (Pending acceptance). Check it and click Accept. If the door has to come from Panel & Pane, click Create PO too; email POs from Purchase orders → Send queue.", "Need action → Accept"],
  ["Accepted · awaiting shipment", "Leroy Merlin moves it here a minute or so after you accept (refresh). Click Ship: check the parcels, get The Courier Guy rates and book. The tracking number goes to Leroy Merlin and the order is marked shipped there. Print the waybill and stickers from the same window. Ship-by dates turn red when overdue.", "Accepted → Ship"],
  ["Shipped", "Booked and marked shipped in Leroy Merlin. The courier delivers.", "Shipped"],
  ["Done · received", "The customer has received it and Leroy Merlin closes the order.", "Done · received"],
  ["Cancelled", "Rejected, cancelled or refunded orders.", "Cancelled"],
];

export default function LmProcess() {
  return (
    <ProcessDialog
      title="Leroy Merlin order process"
      flow="need action → accepted · awaiting shipment → shipped → done · received"
      intro="Leroy Merlin runs on Mirakl. Statuses come straight from Leroy Merlin."
      steps={STEPS}
      footer={<>If booking works but the tracking push fails, the window says so: add the waybill number in the LM portal by hand and click Mark as shipped there.</>}
    />
  );
}
