"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Empty, MpDot, Notice, cx } from "@/components/ui";
import { ago, shortDate } from "@/lib/format";

// Suggest products whose code or SKU-ish text overlaps the unknown SKU
function suggest(sku, products) {
  const s = sku.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (s.length < 3) return [];
  return products
    .map((p) => {
      const c = p.code.toUpperCase().replace(/[^A-Z0-9]/g, "");
      const score = c === s ? 100 : s.includes(c) || c.includes(s) ? 50 : [...Array(Math.max(0, s.length - 3))].some((_, i) => c.includes(s.slice(i, i + 4))) ? 10 : 0;
      return { ...p, score };
    })
    .filter((p) => p.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}

function Row({ u, products, onDone }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const tips = useMemo(() => suggest(u.sku, products), [u.sku, products]);
  const valid = products.some((p) => p.code === code);

  async function map(target) {
    setBusy(true); setErr("");
    const res = await fetch(`/api/products/${encodeURIComponent(target)}/map`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ marketplace: u.marketplace, sku: u.sku }),
    });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setErr(d.error || "Couldn't map"); return; }
    onDone(`${u.sku} → ${target}`);
  }
  async function dismiss() {
    if (!window.confirm(`Dismiss ${u.sku}? It will come back if it shows up on another order.`)) return;
    setBusy(true);
    const res = await fetch("/api/unknown-skus", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: u.id, action: "dismiss" }) });
    setBusy(false);
    if (res.ok) onDone(`${u.sku} dismissed`);
  }

  return (
    <tr>
      <td className="num font-semibold whitespace-nowrap">{u.sku}</td>
      <td className="whitespace-nowrap"><span className="inline-flex items-center gap-1.5"><MpDot mp={u.marketplace} />{u.marketplace}</span></td>
      <td className="r num">{u.occurrence_count}×</td>
      <td className="text-muted whitespace-nowrap" title={`First seen ${shortDate(u.first_seen_at)}`}>{ago(u.last_seen_at)}</td>
      <td className="min-w-[340px]">
        <div className="flex gap-1.5">
          <input className={cx("input num", err && "!border-bad")} list="eb-products" placeholder="Type a warehouse code…" value={code}
            onChange={(e) => setCode(e.target.value.split(" — ")[0].toUpperCase())} disabled={busy} title={err} />
          <Button variant="primary" size="sm" className="!h-[30px]" disabled={!valid || busy} onClick={() => map(code)}>Map</Button>
          <Button variant="ghost" size="sm" className="!h-[30px]" disabled={busy} onClick={dismiss}>Dismiss</Button>
        </div>
        {tips.length ? (
          <div className="flex flex-wrap gap-1 mt-1">
            {tips.map((t) => (
              <button key={t.code} disabled={busy} onClick={() => map(t.code)} className="text-[11px] px-1.5 h-5 rounded bg-sunk text-muted hover:text-ink num" title={t.label}>
                → {t.code}
              </button>
            ))}
          </div>
        ) : null}
        {err ? <div className="text-[11px] text-bad mt-1">{err}</div> : null}
      </td>
    </tr>
  );
}

export default function UnmappedTable({ skus, products }) {
  const router = useRouter();
  const [done, setDone] = useState([]);
  const [mp, setMp] = useState("");
  const rows = skus.filter((u) => !mp || u.marketplace === mp);

  const onDone = (text) => { setDone((d) => [text, ...d].slice(0, 5)); router.refresh(); };

  return (
    <div className="grid gap-3">
      {done.length ? <Notice tone="ok">{done.join(" · ")}</Notice> : null}
      <div className="bg-panel border border-line rounded-md">
        <div className="flex items-center gap-1 p-2 border-b border-line">
          {[["", "All"], ["shopify", "Shopify"], ["takealot", "Takealot"], ["leroymerlin", "Leroy Merlin"]].map(([k, l]) => (
            <button key={k} onClick={() => setMp(k)} className={cx("h-[26px] px-2 rounded-[5px] text-[12px] border", mp === k ? "bg-accent-soft border-transparent text-accent font-semibold" : "border-line text-muted hover:text-ink")}>
              {l} <span className="num opacity-70">{k ? skus.filter((u) => u.marketplace === k).length : skus.length}</span>
            </button>
          ))}
        </div>
        <datalist id="eb-products">{products.map((p) => <option key={p.code} value={p.label} />)}</datalist>
        {rows.length ? (
          <div className="overflow-auto">
            <table className="tbl">
              <thead><tr><th>Marketplace SKU</th><th>Channel</th><th className="r">Seen</th><th>Last seen</th><th>Map to product</th></tr></thead>
              <tbody>{rows.map((u) => <Row key={u.id} u={u} products={products} onDone={onDone} />)}</tbody>
            </table>
          </div>
        ) : <Empty>Nothing to map. Every SKU on recent orders matches a product.</Empty>}
      </div>
    </div>
  );
}
