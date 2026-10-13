"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { PageHeader, Panel, Field, Button, Badge, Notice, MpDot } from "@/components/ui";
import CategorySelect from "@/components/category-select";
import { MARKETPLACES } from "@/lib/categories";
import { zar, withVat, shortDate } from "@/lib/format";

export default function ProductEditor({ product, history, aliases, categories, isAdmin }) {
  const router = useRouter();
  const code = product.warehouse_code;
  const [form, setForm] = useState(product);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [map, setMap] = useState({ marketplace: "shopify", sku: "" });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });
  const dirty = ["nickname", "description", "size", "category", "shopify_sku", "takealot_sku", "leroymerlin_sku", "cost_excl_vat", "free_issue", "notes"]
    .some((k) => String(form[k] ?? "") !== String(product[k] ?? ""));

  async function call(url, method, body) {
    setBusy(true); setMsg(null);
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setMsg({ tone: "bad", text: d.error || "Something went wrong" }); return null; }
    return d;
  }

  async function save() {
    const { warehouse_code, created_at, updated_at, updated_by, cost_incl_vat, active, ...rest } = form;
    const d = await call(`/api/products/${encodeURIComponent(code)}`, "PATCH", rest);
    if (d) { setForm(d.product); setMsg({ tone: "ok", text: "Saved." }); router.refresh(); }
  }
  async function setActive(active) {
    if (!active && !window.confirm(`Archive ${code}? It disappears from the active list but its history stays.`)) return;
    const d = await call(`/api/products/${encodeURIComponent(code)}`, "PATCH", { active });
    if (d) { setForm(d.product); setMsg({ tone: "ok", text: active ? "Restored." : "Archived." }); router.refresh(); }
  }
  async function addMap(e) {
    e.preventDefault();
    const d = await call(`/api/products/${encodeURIComponent(code)}/map`, "POST", map);
    if (d) {
      const text = { primary_set: "Set as the main SKU.", alias_added: "Added as an extra SKU.", already_primary: "That's already the main SKU.", already_alias: "Already mapped." }[d.method];
      setMsg({ tone: "ok", text }); setMap({ ...map, sku: "" }); router.refresh();
    }
  }
  async function removeAlias(a) {
    if (!window.confirm(`Remove ${a.sku} from ${code}? Orders with that SKU will show as unmapped again.`)) return;
    if (await call(`/api/aliases/${a.id}`, "DELETE")) router.refresh();
  }

  const ro = !isAdmin;
  const incl = withVat(form.cost_excl_vat);

  return (
    <div>
      <PageHeader
        crumbs={[{ label: "Products", href: "/products" }, { label: code }]}
        title={<span className="num">{code}</span>}
        sub={product.description}
        actions={isAdmin ? (
          <>
            {product.active ? <Button variant="danger" onClick={() => setActive(false)} disabled={busy}>Archive</Button>
              : <Button onClick={() => setActive(true)} disabled={busy}>Restore</Button>}
            <Button variant="primary" onClick={save} disabled={busy || !dirty}>{busy ? "Saving…" : dirty ? "Save changes" : "Saved"}</Button>
          </>
        ) : null}
      />
      {!product.active ? <div className="mb-3"><Notice tone="warn">This product is archived.</Notice></div> : null}
      {msg ? <div className="mb-3"><Notice tone={msg.tone}>{msg.text}</Notice></div> : null}

      <div className="grid xl:grid-cols-[1fr_1fr_360px] lg:grid-cols-2 gap-3 items-start">
        <Panel title="Warehouse">
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Warehouse code" hint="Can't be changed"><input className="input num" value={code} disabled /></Field>
              <Field label="Nickname"><input className="input" value={form.nickname || ""} onChange={set("nickname")} disabled={ro} placeholder="Optional" /></Field>
            </div>
            <Field label="Description"><input className="input" value={form.description || ""} onChange={set("description")} disabled={ro} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Size"><input className="input num" value={form.size || ""} onChange={set("size")} disabled={ro} placeholder="2100x920x40" /></Field>
              <Field label="Category"><CategorySelect value={form.category} onChange={(v) => setForm({ ...form, category: v })} categories={categories} disabled={ro} /></Field>
            </div>
            <Field label="Notes"><textarea className="input" rows={3} value={form.notes || ""} onChange={set("notes")} disabled={ro} /></Field>
          </div>
        </Panel>

        <Panel title="Marketplace SKUs">
          <div className="grid gap-3">
            {Object.entries(MARKETPLACES).map(([mp, m]) => (
              <Field key={mp} label={<span className="inline-flex items-center gap-1.5"><MpDot mp={mp} />{m.label} — main SKU</span>}
                hint={mp === "leroymerlin" && form.leroymerlin_sku && form.leroymerlin_sku !== code ? `LM orders for ${form.leroymerlin_sku} pick as ${code}` : null}>
                <input className="input num" value={form[m.col] || ""} onChange={set(m.col)} disabled={ro} />
              </Field>
            ))}
          </div>
          <div className="mt-4 pt-3 border-t border-line">
            <div className="text-[11px] font-medium text-muted mb-1.5">Extra SKUs (aliases)</div>
            {aliases.length ? (
              <ul className="grid gap-1 mb-2">
                {aliases.map((a) => (
                  <li key={a.id} className="flex items-center gap-2 h-7 px-2 bg-sunk rounded">
                    <MpDot mp={a.marketplace} />
                    <span className="num">{a.sku}</span>
                    <span className="text-[11px] text-faint truncate flex-1" title={a.note || ""}>{a.note || ""}</span>
                    {isAdmin ? <button onClick={() => removeAlias(a)} className="text-faint hover:text-bad" aria-label={`Remove ${a.sku}`}><Trash2 size={13} /></button> : null}
                  </li>
                ))}
              </ul>
            ) : <p className="text-[12px] text-faint mb-2">None. Old or renamed marketplace SKUs can be added here so they still pick as {code}.</p>}
            {isAdmin ? (
              <form onSubmit={addMap} className="flex gap-1.5">
                <select className="input !w-[120px]" value={map.marketplace} onChange={(e) => setMap({ ...map, marketplace: e.target.value })}>
                  {Object.entries(MARKETPLACES).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
                </select>
                <input className="input num" placeholder="SKU" value={map.sku} onChange={(e) => setMap({ ...map, sku: e.target.value })} />
                <Button type="submit" disabled={busy || !map.sku.trim()}>Add</Button>
              </form>
            ) : null}
          </div>
        </Panel>

        <div className="grid gap-3">
          <Panel title="Cost">
            <div className="grid gap-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Cost excl VAT"><input className="input num text-right" type="number" step="0.01" min="0" value={form.cost_excl_vat ?? ""} onChange={set("cost_excl_vat")} disabled={ro} placeholder="0.00" /></Field>
                <Field label="Incl VAT (×1.15)"><div className="input num text-right flex items-center justify-end bg-sunk">{incl != null ? zar(incl) : "—"}</div></Field>
              </div>
              <label className="flex items-start gap-2 text-[13px]">
                <input type="checkbox" className="mt-0.5" checked={!!form.free_issue} onChange={set("free_issue")} disabled={ro} />
                <span>Free-issue hardware<span className="block text-[11px] text-faint">Counts in P&amp;L but is left off POs sent to P&amp;P</span></span>
              </label>
            </div>
          </Panel>
          <Panel title="Cost history" pad={false}>
            {history.length ? (
              <table className="tbl">
                <thead><tr><th className="r">Ex VAT</th><th>From</th><th>To</th></tr></thead>
                <tbody>
                  {history.map((h) => (
                    <tr key={h.id}>
                      <td className="r num">{zar(h.cost_excl_vat)}</td>
                      <td className="text-muted">{shortDate(h.effective_from)}</td>
                      <td>{h.effective_to ? <span className="text-muted">{shortDate(h.effective_to)}</span> : <Badge tone="ok">Current</Badge>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <p className="p-3 text-[12px] text-faint">No cost changes recorded yet.</p>}
          </Panel>
          <p className="text-[11px] text-faint px-1">Last updated {shortDate(product.updated_at)}</p>
        </div>
      </div>
    </div>
  );
}
