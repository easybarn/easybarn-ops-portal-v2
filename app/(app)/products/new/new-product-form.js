"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader, Panel, Field, Button, Notice, MpDot } from "@/components/ui";
import CategorySelect from "@/components/category-select";
import { MARKETPLACES } from "@/lib/categories";
import { zar, withVat } from "@/lib/format";

const EMPTY = { warehouse_code: "", description: "", nickname: "", size: "", category: "", shopify_sku: "", takealot_sku: "", leroymerlin_sku: "", cost_excl_vat: "", free_issue: false, notes: "" };

export default function NewProductForm({ categories }) {
  const router = useRouter();
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });

  async function submit(e) {
    e.preventDefault();
    if (!form.category) { setError("Choose a category."); return; }
    setBusy(true); setError("");
    const res = await fetch("/api/products", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { setError(d.error || "Couldn't create the product"); setBusy(false); return; }
    router.push(`/products/${encodeURIComponent(d.product.warehouse_code)}`);
    router.refresh();
  }

  return (
    <form onSubmit={submit}>
      <PageHeader crumbs={[{ label: "Products", href: "/products" }, { label: "New" }]} title="New product"
        actions={<Button type="submit" variant="primary" disabled={busy}>{busy ? "Creating…" : "Create product"}</Button>} />
      {error ? <div className="mb-3"><Notice tone="bad">{error}</Notice></div> : null}
      <div className="grid lg:grid-cols-3 gap-3 items-start max-w-[1200px]">
        <Panel title="Warehouse">
          <div className="grid gap-3">
            <Field label="Warehouse code *"><input className="input num" required autoFocus placeholder="BARN9999" value={form.warehouse_code} onChange={(e) => setForm({ ...form, warehouse_code: e.target.value.toUpperCase() })} /></Field>
            <Field label="Description *"><input className="input" required value={form.description} onChange={set("description")} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Size"><input className="input num" value={form.size} onChange={set("size")} placeholder="2100x920x40" /></Field>
              <Field label="Nickname"><input className="input" value={form.nickname} onChange={set("nickname")} /></Field>
            </div>
            <Field label="Category *"><CategorySelect value={form.category} onChange={(v) => setForm({ ...form, category: v })} categories={categories} /></Field>
          </div>
        </Panel>
        <Panel title="Marketplace SKUs">
          <div className="grid gap-3">
            {Object.entries(MARKETPLACES).map(([mp, m]) => (
              <Field key={mp} label={<span className="inline-flex items-center gap-1.5"><MpDot mp={mp} />{m.label}</span>}>
                <input className="input num" value={form[m.col]} onChange={set(m.col)} />
              </Field>
            ))}
          </div>
        </Panel>
        <Panel title="Cost & notes">
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Cost excl VAT"><input className="input num text-right" type="number" step="0.01" min="0" value={form.cost_excl_vat} onChange={set("cost_excl_vat")} /></Field>
              <Field label="Incl VAT"><div className="input num flex items-center justify-end bg-sunk">{form.cost_excl_vat ? zar(withVat(form.cost_excl_vat)) : "—"}</div></Field>
            </div>
            <label className="flex items-center gap-2"><input type="checkbox" checked={form.free_issue} onChange={set("free_issue")} />Free-issue hardware</label>
            <Field label="Notes"><textarea className="input" rows={3} value={form.notes} onChange={set("notes")} /></Field>
          </div>
        </Panel>
      </div>
    </form>
  );
}
