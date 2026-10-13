"use client";

import { useState } from "react";
import { FileText, Package, Tag } from "lucide-react";
import { Panel } from "@/components/ui";

const num = (v, min, max) => Math.max(min, Math.min(max, parseInt(v || "0", 10) || 0));

function Card({ icon: Icon, title, hint, href, children }) {
  return (
    <div className="border border-line rounded-md p-3 flex flex-col gap-2">
      <div className="flex items-center gap-2 font-semibold"><Icon size={15} className="text-accent" />{title}</div>
      <div className="text-[12px] text-muted flex-1">{hint}</div>
      {children}
      <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center h-[30px] rounded-[5px] bg-accent text-accent-ink font-medium hover:brightness-110">Open PDF</a>
    </div>
  );
}

export default function PrintPack({ id, lines, units }) {
  const [boxes, setBoxes] = useState(Math.max(1, lines));
  const [shipSkip, setShipSkip] = useState(0);
  const [prodSkip, setProdSkip] = useState(0);
  const base = `/api/takealot/shipments/${id}`;
  return (
    <Panel title="Print pack" actions={<span className="text-[11px] text-faint">Print at 100% scale, not “fit to page”</span>}>
      <div className="grid md:grid-cols-3 gap-3">
        <Card icon={FileText} title="Shipping note" hint="1 page A4. Goes inside the box." href={`${base}/shipping-note`} />
        <Card icon={Package} title="Shipping labels" hint="6-up A4. One per box or parcel." href={`${base}/shipping-labels?count=${boxes}&usedSkip=${shipSkip}`}>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-[11px] text-muted">Boxes<input type="number" min="1" max="60" className="input mt-0.5" value={boxes} onChange={(e) => setBoxes(num(e.target.value, 1, 60))} /></label>
            <label className="text-[11px] text-muted">Labels used on sheet<input type="number" min="0" max="5" className="input mt-0.5" value={shipSkip} onChange={(e) => setShipSkip(num(e.target.value, 0, 5))} /></label>
          </div>
        </Card>
        <Card icon={Tag} title="Product labels" hint={`45-up A4. One per unit: ${units} label${units === 1 ? "" : "s"}.`} href={`${base}/product-labels?usedSkip=${prodSkip}`}>
          <label className="text-[11px] text-muted">Labels used on sheet<input type="number" min="0" max="44" className="input mt-0.5" value={prodSkip} onChange={(e) => setProdSkip(num(e.target.value, 0, 44))} /></label>
        </Card>
      </div>
    </Panel>
  );
}
