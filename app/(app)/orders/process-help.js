"use client";

import { useEffect, useState } from "react";
import { HelpCircle, X } from "lucide-react";

const STEPS = [
  ["1 · New", "Any new paid order gets a draft PO to Panel & Pane automatically when you open or refresh this page. It then shows ✓ PO raised with its PO number and moves to step 2. The yellow banner shows how many POs still need emailing, with a link to the send queue. Older orders without a PO: tick them here and click Raise POs."],
  ["2 · PO raised", "Tick orders, then Create picking slip, or add them to a recent open slip."],
  ["3 · On slip", "Open the slip and tick lines off as you pick. Ticking a P&P code ticks it on every order on the slip. Flag short or damaged stock, take an order off the slip, or print the slip (pick list, then a box per order with Packed by and Parcels lines)."],
  ["4 · Ready to ship", "Fully picked orders land here with a Ship button: get The Courier Guy rates, book, and the Shopify order is fulfilled with the tracking number."],
  ["Shipped", "Orders with tracking. Reprint waybills and stickers from the order page or the Print queue."],
];

export default function ProcessHelp() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const k = (e) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open]);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="h-[28px] px-2.5 rounded-[5px] flex items-center gap-1 text-[13px] text-muted hover:text-ink" title="How the order process works">
        <HelpCircle size={14} /> Process
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 bg-black/45 flex items-start md:items-center justify-center p-3" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div role="dialog" aria-modal="true" aria-label="Shopify order process" className="bg-panel border border-line rounded-md w-full max-w-[680px] shadow-2xl">
            <div className="flex items-center gap-2 px-4 h-11 border-b border-line">
              <HelpCircle size={15} className="text-accent" />
              <b>Shopify order process</b>
              <span className="text-muted text-[12px]">new order → PO → picking slip → ship</span>
              <button className="ml-auto p-1 text-muted hover:text-ink" onClick={() => setOpen(false)} aria-label="Close"><X size={16} /></button>
            </div>
            <div className="p-4">
              <p className="text-muted text-[12px] mb-3">Orders only appear here once they&apos;re paid. Each tab shows how many orders are at that step.</p>
              <table className="tbl">
                <thead><tr><th className="w-[130px]">Step</th><th>What happens</th></tr></thead>
                <tbody>
                  {STEPS.map(([step, text]) => (
                    <tr key={step}><td className="font-semibold whitespace-nowrap align-top">{step}</td><td className="align-top leading-relaxed">{text}</td></tr>
                  ))}
                </tbody>
              </table>
              <p className="text-[12px] text-muted mt-3">Purchase orders are emailed to Panel &amp; Pane from <b>Purchase orders → Send queue</b>: select all, then Email selected (one email, every PDF attached).</p>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
