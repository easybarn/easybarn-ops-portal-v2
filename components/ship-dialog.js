"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { X, Plus, Trash2, Truck, FileText, Tag } from "lucide-react";
import { Button, Notice, Badge, cx } from "@/components/ui";
import { zar } from "@/lib/format";

export const PRESETS = [
  { code: "barn", name: "Barn door", dims: [215, 95, 5, 22] },
  { code: "bifold", name: "Bifold door", dims: [215, 45, 8, 22] },
  { code: "barnfold", name: "Barn fold door", dims: [215, 45, 8, 22] },
  { code: "std", name: "Standard door", dims: [215, 85, 5, 22] },
  { code: "barn_track", name: "Barn track", dims: [215, 5, 5, 5] },
  { code: "barnfold_track", name: "Barn fold track", dims: [100, 5, 5, 5] },
  { code: "bifold_track", name: "Bifold track box", dims: [100, 3, 3, 3] },
  { code: "flyer", name: "TCG flyer", dims: [46, 38, 5, 2] },
  { code: "custom", name: "Custom", dims: null },
];
const preset = (code) => PRESETS.find((p) => p.code === code);
const parcel = (code) => { const p = preset(code); const [length, width, height, weight] = p.dims || [210, 95, 8, 25]; return { type: code, length, width, height, weight }; };

// Suggest parcels from the P&P codes on the order
export function suggestParcels(items) {
  const out = [];
  for (const i of items) {
    const code = (i.product?.code || i.sku || "").toUpperCase();
    const n = Math.max(1, Number(i.qty) || 1);
    let type = null;
    if (/^(BFOLD|BARN ?F)/.test(code)) type = "barnfold";
    else if (/^(BARN|STEEL)/.test(code)) type = "barn";
    else if (/^BF/.test(code)) type = "bifold";
    else if (/^(PW|SHA|MP|NT)/.test(code)) type = "std";
    else if (code === "HARD001") type = "barn_track";
    else if (code === "HARD002") type = "barnfold_track";
    else if (code === "HARD006") type = "bifold_track";
    if (type) for (let k = 0; k < n; k++) out.push(parcel(type));
  }
  return out.length ? out : [parcel("custom")];
}

function nextWorkday() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}
const day = (s) => (s ? new Date(s).toLocaleDateString("en-ZA", { weekday: "short", day: "2-digit", month: "short" }) : "");
const volKg = (p) => (Number(p.length) * Number(p.width) * Number(p.height)) / 5000;

export default function ShipDialog({ order, onClose }) {
  const router = useRouter();
  const [step, setStep] = useState("parcels");
  const [parcels, setParcels] = useState(() => suggestParcels(order.items));
  const [date, setDate] = useState(nextWorkday);
  const [rates, setRates] = useState([]);
  const [rate, setRate] = useState(null);
  const [notify, setNotify] = useState(true);
  const [rebook, setRebook] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [slot, setSlot] = useState(1);

  useEffect(() => {
    const k = (e) => { if (e.key === "Escape" && !busy) close(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  });

  const billable = useMemo(() => parcels.reduce((s, p) => s + Math.max(Number(p.weight) || 0, volKg(p)), 0), [parcels]);
  const valid = parcels.length > 0 && parcels.every((p) => ["length", "width", "height", "weight"].every((k) => Number(p[k]) > 0));
  const upd = (i, patch) => setParcels((ps) => ps.map((p, j) => (j === i ? { ...p, ...patch } : p)));

  function close() { if (result) router.refresh(); onClose(); }

  async function post(url, body) {
    setBusy(true); setError("");
    try {
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Request failed");
      return d;
    } catch (e) { setError(e.message); return null; }
    finally { setBusy(false); }
  }

  async function getRates() {
    const d = await post("/api/courier/rates", { orderId: order.id, parcels, collectionDate: date });
    if (d) { setRates(d.rates); setRate(d.rates[0] || null); setStep("rates"); }
  }
  async function book() {
    const d = await post("/api/courier/book", { orderId: order.id, parcels, serviceLevelCode: rate.code, collectionDate: date, notifyCustomer: notify, allowRebook: rebook });
    if (d) { setResult(d); setStep("done"); }
  }

  const addr = order.address || {};
  const already = order.tracking?.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-start md:items-center justify-center bg-black/45 p-3 overflow-y-auto" onMouseDown={(e) => e.target === e.currentTarget && !busy && close()}>
      <div role="dialog" aria-modal="true" aria-label={`Ship ${order.name}`} className="bg-panel border border-line rounded-md w-full max-w-[760px] shadow-2xl">
        <div className="flex items-center gap-3 px-4 h-11 border-b border-line">
          <Truck size={16} className="text-accent" />
          <div className="font-semibold">Ship <span className="num">{order.name}</span></div>
          <div className="text-muted truncate">· {order.customer.name} · {[addr.city, addr.provinceCode || addr.province].filter(Boolean).join(", ")}</div>
          <button className="ml-auto p-1 text-muted hover:text-ink" onClick={close} aria-label="Close" disabled={busy}><X size={16} /></button>
        </div>

        <div className="flex gap-1 px-4 pt-3 text-[11px] font-semibold uppercase tracking-wide">
          {["parcels", "rates", "done"].map((s, i) => (
            <span key={s} className={cx("px-2 h-5 rounded flex items-center", step === s ? "bg-accent-soft text-accent" : "text-faint")}>{i + 1}. {s === "parcels" ? "Parcels" : s === "rates" ? "Service" : "Booked"}</span>
          ))}
        </div>

        <div className="p-4 grid gap-3">
          {error ? <Notice tone="bad">{error}</Notice> : null}
          {already && step !== "done" ? (
            <Notice tone="warn">
              Already shipped with {order.tracking.map((t) => t.number).join(", ")}.
              <label className="flex items-center gap-2 mt-1"><input type="checkbox" checked={rebook} onChange={(e) => setRebook(e.target.checked)} /> Book another shipment for this order</label>
            </Notice>
          ) : null}

          {step === "parcels" ? (
            <>
              <div className="text-[12px] text-muted">Suggested from the products on the order. Adjust as needed.</div>
              <table className="tbl">
                <thead><tr><th>#</th><th>Type</th><th className="r">L cm</th><th className="r">W cm</th><th className="r">H cm</th><th className="r">Kg</th><th className="r">Vol kg</th><th></th></tr></thead>
                <tbody>
                  {parcels.map((p, i) => (
                    <tr key={i}>
                      <td className="num text-muted">{i + 1}</td>
                      <td>
                        <select className="input !h-[26px] !w-[150px]" value={p.type} onChange={(e) => { const pr = preset(e.target.value); upd(i, pr?.dims ? { ...parcel(e.target.value) } : { type: "custom" }); }}>
                          {PRESETS.map((t) => <option key={t.code} value={t.code}>{t.name}</option>)}
                        </select>
                      </td>
                      {["length", "width", "height", "weight"].map((k) => (
                        <td key={k} className="r"><input type="number" min="0" step="0.1" className="input num !h-[26px] !w-[64px] text-right" value={p[k]} onChange={(e) => upd(i, { [k]: e.target.value, type: "custom" })} aria-label={k} /></td>
                      ))}
                      <td className="r num text-muted">{volKg(p).toFixed(1)}</td>
                      <td className="r"><button className="text-faint hover:text-bad p-1" onClick={() => setParcels((ps) => ps.filter((_, j) => j !== i))} aria-label="Remove parcel"><Trash2 size={13} /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex flex-wrap items-center gap-3">
                <Button size="sm" onClick={() => setParcels((ps) => [...ps, parcel("custom")])}><Plus size={13} /> Add parcel</Button>
                <span className="text-[12px] text-muted">{parcels.length} parcel{parcels.length === 1 ? "" : "s"} · billable <span className="num">{billable.toFixed(1)} kg</span></span>
                <label className="ml-auto flex items-center gap-2 text-[12px] text-muted">Collect from
                  <input type="date" className="input !w-auto" value={date} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setDate(e.target.value)} />
                </label>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <Button onClick={close} disabled={busy}>Cancel</Button>
                <Button variant="primary" onClick={getRates} disabled={!valid || busy || (already && !rebook)}>{busy ? "Getting rates…" : "Get rates"}</Button>
              </div>
            </>
          ) : null}

          {step === "rates" ? (
            <>
              {rates.length ? (
                <div className="grid gap-1.5">
                  {rates.map((r) => (
                    <label key={r.code} className={cx("flex items-center gap-3 px-3 h-12 rounded-md border cursor-pointer", rate?.code === r.code ? "border-accent bg-accent-soft" : "border-line hover:bg-hover")}>
                      <input type="radio" name="rate" checked={rate?.code === r.code} onChange={() => setRate(r)} />
                      <div className="min-w-0 flex-1">
                        <div className="font-medium">{r.name} <span className="text-faint num text-[11px]">{r.code}</span></div>
                        <div className="text-[11px] text-muted">{r.from ? `Delivers ${day(r.from)}${r.to && day(r.to) !== day(r.from) ? " – " + day(r.to) : ""}` : r.description}</div>
                      </div>
                      <div className="num font-semibold">{zar(r.rate)}</div>
                    </label>
                  ))}
                </div>
              ) : <Notice tone="warn">The Courier Guy returned no services for this address and parcel set.</Notice>}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[12px] bg-sunk rounded-md p-2.5">
                <div><div className="text-faint">Collect</div><div className="font-medium">{day(date)}</div></div>
                <div><div className="text-faint">Parcels</div><div className="font-medium num">{parcels.length} · {billable.toFixed(1)} kg</div></div>
                <div className="col-span-2"><div className="text-faint">Deliver to</div><div className="font-medium truncate">{[addr.address1, addr.city, addr.zip].filter(Boolean).join(", ")}</div></div>
              </div>
              <label className="flex items-center gap-2 text-[12px]"><input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} /> Email the customer their tracking number (Shopify shipping confirmation)</label>
              <div className="flex justify-between gap-2">
                <Button onClick={() => setStep("parcels")} disabled={busy}>Back</Button>
                <Button variant="primary" onClick={book} disabled={!rate || busy}>{busy ? "Booking…" : rate ? `Book ${rate.name} · ${zar(rate.rate)}` : "Book"}</Button>
              </div>
            </>
          ) : null}

          {step === "done" && result ? (
            <>
              <Notice tone="ok">
                Booked. Waybill <span className="num font-semibold">{result.trackingReference}</span>
                {result.fulfilled ? " · Shopify order marked fulfilled" : ""}
                {result.linked?.slips || result.linked?.pos ? ` · added to ${[result.linked.slips && "picking slip", result.linked.pos && "PO"].filter(Boolean).join(" and ")}` : ""}
              </Notice>
              {result.warnings?.map((w) => <Notice key={w} tone="warn">{w}</Notice>)}
              <div className="flex flex-wrap items-center gap-2">
                <a className="inline-flex items-center gap-1.5 h-[30px] px-3 rounded-[5px] bg-accent text-accent-ink font-medium" href={`/api/courier/waybill?ref=${encodeURIComponent(result.trackingReference)}`} target="_blank" rel="noreferrer"><FileText size={14} /> Print waybill</a>
                <span className="text-[12px] text-muted ml-2">Stickers start at slot</span>
                <div className="inline-grid grid-cols-6 gap-1">
                  {[1, 2, 3, 4, 5, 6].map((n) => (
                    <button key={n} onClick={() => setSlot(n)} className={cx("w-7 h-7 rounded border num text-[12px]", slot === n ? "bg-accent-soft border-accent text-accent font-semibold" : "border-line text-muted")}>{n}</button>
                  ))}
                </div>
                <a className="inline-flex items-center gap-1.5 h-[30px] px-3 rounded-[5px] border border-line-strong font-medium hover:bg-hover" href={`/api/courier/stickers?refs=${encodeURIComponent(result.trackingReference)}&startSlot=${slot}`} target="_blank" rel="noreferrer"><Tag size={14} /> Print stickers</a>
              </div>
              <div className="text-[11px] text-faint">Slots run left-to-right, top-to-bottom on the A4 sheet (1–2 top, 5–6 bottom). <Badge>6-up</Badge></div>
              <div className="flex justify-end"><Button variant="primary" onClick={close}>Done</Button></div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
