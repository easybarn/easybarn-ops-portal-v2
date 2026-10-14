"use client";

import ProcessDialog from "@/components/process-dialog";

const STEPS = [
  ["1 · Order comes in", "A customer orders on Leroy Merlin. It shows under Needs action as Pending acceptance.", "Needs action"],
  ["2 · Accept it", "Click Accept on the order. Leroy Merlin takes a minute to move it to Awaiting shipment (refresh to see it). Ship-by dates turn red once overdue.", "Needs action → Accept"],
  ["3 · Stock from Panel & Pane (if needed)", "Click Create PO on the order. The PO goes into the send queue; email it from Purchase orders → Send queue.", "Needs action · Purchase orders"],
  ["4 · Ship", "Click Ship: check the parcels, get The Courier Guy rates and book. The tracking number is sent to Leroy Merlin and the order is marked shipped there automatically. Print the waybill and stickers from the same window.", "Needs action → Ship"],
  ["5 · Delivered", "The order moves to Shipped, then Done once Leroy Merlin closes it.", "Shipped · Done"],
];

export default function LmProcess() {
  return (
    <ProcessDialog
      title="Leroy Merlin order process"
      flow="order → accept in LM → (PO) → ship → done"
      intro="Leroy Merlin runs on Mirakl. Statuses come straight from Leroy Merlin."
      steps={STEPS}
      footer={<>If booking works but the tracking push fails, the window says so: add the waybill number in the LM portal by hand and click Mark as shipped there.</>}
    />
  );
}
