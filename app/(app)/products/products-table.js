"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Search, ArrowUp, ArrowDown } from "lucide-react";
import { Badge, Empty, cx } from "@/components/ui";
import { zar, withVat } from "@/lib/format";

const FILTERS = [
  ["", "All"],
  ["no_cost", "Missing cost"],
  ["with_cost", "Has cost"],
  ["free_issue", "Free issue"],
  ["no_sku", "No marketplace SKU"],
];

function CostCell({ p, isAdmin }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(p.cost_excl_vat ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function save() {
    if (String(val) === String(p.cost_excl_vat ?? "")) { setEditing(false); return; }
    setBusy(true); setErr("");
    const res = await fetch(`/api/products/${encodeURIComponent(p.warehouse_code)}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cost_excl_vat: val }),
    });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setErr(d.error || "Save failed"); return; }
    setEditing(false);
    router.refresh();
  }

  if (editing) {
    return (
      <input
        autoFocus type="number" step="0.01" min="0" value={val} disabled={busy}
        onChange={(e) => setVal(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") { setVal(p.cost_excl_vat ?? ""); setEditing(false); } }}
        title={err || "Enter to save, Esc to cancel"}
        className={cx("input num !h-[24px] w-[110px] text-right", err && "!border-bad")}
        onClick={(e) => e.stopPropagation()}
      />
    );
  }
  const content = p.cost_excl_vat != null ? <span className="num">{zar(p.cost_excl_vat)}</span>
    : p.free_issue ? <span className="text-faint">—</span>
    : <span className="text-warn font-medium">no cost</span>;
  return isAdmin ? (
    <button className="hover:underline decoration-dotted cursor-text" title="Click to edit cost" onClick={(e) => { e.stopPropagation(); setEditing(true); }}>{content}</button>
  ) : content;
}

function Th({ k, children, right, sort, setSort }) {
  return (
    <th className={right ? "r" : ""}>
      <button className="inline-flex items-center gap-1 uppercase hover:text-ink" onClick={() => setSort((s) => ({ key: k, dir: s.key === k ? -s.dir : 1 }))}>
        {children}
        {sort.key === k ? (sort.dir === 1 ? <ArrowUp size={11} /> : <ArrowDown size={11} />) : null}
      </button>
    </th>
  );
}

export default function ProductsTable({ products, categories, isAdmin, archived, initialFilter, initialQuery }) {
  const router = useRouter();
  const [q, setQ] = useState(initialQuery);
  const [cat, setCat] = useState("");
  const [filter, setFilter] = useState(initialFilter);
  const [sort, setSort] = useState({ key: "warehouse_code", dir: 1 });
  const searchRef = useRef(null);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "/" && document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") {
        e.preventDefault(); searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    const out = products.filter((p) => {
      if (cat && p.category !== cat) return false;
      if (filter === "no_cost" && (p.cost_excl_vat != null || p.free_issue)) return false;
      if (filter === "with_cost" && p.cost_excl_vat == null) return false;
      if (filter === "free_issue" && !p.free_issue) return false;
      if (filter === "no_sku" && (p.shopify_sku || p.takealot_sku || p.leroymerlin_sku)) return false;
      if (!s) return true;
      return [p.warehouse_code, p.nickname, p.description, p.size, p.shopify_sku, p.takealot_sku, p.leroymerlin_sku]
        .some((v) => v && String(v).toLowerCase().includes(s));
    });
    const { key, dir } = sort;
    return out.sort((a, b) => {
      const x = a[key], y = b[key];
      if (x == null && y == null) return 0;
      if (x == null) return 1;
      if (y == null) return -1;
      return (typeof x === "number" ? x - y : String(x).localeCompare(String(y), "en", { numeric: true })) * dir;
    });
  }, [products, q, cat, filter, sort]);

  const counts = useMemo(() => ({
    no_cost: products.filter((p) => p.cost_excl_vat == null && !p.free_issue).length,
    with_cost: products.filter((p) => p.cost_excl_vat != null).length,
    free_issue: products.filter((p) => p.free_issue).length,
    no_sku: products.filter((p) => !p.shopify_sku && !p.takealot_sku && !p.leroymerlin_sku).length,
    "": products.length,
  }), [products]);

  return (
    <div className="bg-panel border border-line rounded-md">
      <div className="flex flex-wrap items-center gap-2 p-2 border-b border-line">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-faint" />
          <input ref={searchRef} className="input !pl-7" placeholder="Search code, name, size or any SKU   ( / )" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select className="input !w-auto" value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Category">
          <option value="">All categories</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <div className="flex flex-wrap gap-1">
          {FILTERS.map(([k, label]) => (
            <button key={k} onClick={() => setFilter(k)}
              className={cx("h-[26px] px-2 rounded-[5px] text-[12px] border", filter === k ? "bg-accent-soft border-transparent text-accent font-semibold" : "border-line text-muted hover:text-ink")}>
              {label} <span className="num opacity-70">{counts[k]}</span>
            </button>
          ))}
        </div>
        <label className="flex items-center gap-1.5 text-[12px] text-muted ml-auto">
          <input type="checkbox" checked={archived} onChange={(e) => router.push(e.target.checked ? "/products?archived=1" : "/products")} />
          Show archived
        </label>
      </div>

      <div className="overflow-auto max-h-[calc(100vh-190px)]">
        {rows.length ? (
          <table className="tbl">
            <thead>
              <tr>
                <Th sort={sort} setSort={setSort} k="warehouse_code">Code</Th>
                <Th sort={sort} setSort={setSort} k="description">Description</Th>
                <Th sort={sort} setSort={setSort} k="size">Size</Th>
                <Th sort={sort} setSort={setSort} k="category">Category</Th>
                <th>Shopify</th><th>Takealot</th><th>Leroy Merlin</th>
                <Th sort={sort} setSort={setSort} k="cost_excl_vat" right>Cost ex VAT</Th>
                <th className="r">Incl VAT</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.warehouse_code} className={cx("cursor-pointer", !p.active && "opacity-55")} onClick={() => router.push(`/products/${encodeURIComponent(p.warehouse_code)}`)}>
                  <td className="whitespace-nowrap">
                    <Link href={`/products/${encodeURIComponent(p.warehouse_code)}`} className="num font-semibold hover:text-accent" onClick={(e) => e.stopPropagation()}>{p.warehouse_code}</Link>
                    {p.nickname ? <div className="text-[11px] text-faint">{p.nickname}</div> : null}
                  </td>
                  <td className="max-w-[320px] truncate" title={p.description}>{p.description}</td>
                  <td className="num text-muted whitespace-nowrap">{p.size || ""}</td>
                  <td className="text-muted whitespace-nowrap">{p.category || ""}</td>
                  <td className="num text-[12px]">{p.shopify_sku || <span className="text-faint">—</span>}</td>
                  <td className="num text-[12px]">{p.takealot_sku || <span className="text-faint">—</span>}</td>
                  <td className="num text-[12px]">{p.leroymerlin_sku || <span className="text-faint">—</span>}</td>
                  <td className="r whitespace-nowrap"><CostCell key={p.cost_excl_vat ?? "x"} p={p} isAdmin={isAdmin} /></td>
                  <td className="r num text-muted whitespace-nowrap">{p.cost_excl_vat != null ? zar(withVat(p.cost_excl_vat)) : ""}</td>
                  <td className="whitespace-nowrap">
                    {p.free_issue ? <Badge tone="info">Free issue</Badge> : null}
                    {!p.active ? <Badge>Archived</Badge> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <Empty>No products match.</Empty>}
      </div>
      <div className="px-3 h-8 flex items-center text-[11px] text-faint border-t border-line">
        Showing <span className="num mx-1">{rows.length}</span> of <span className="num mx-1">{products.length}</span>
        {isAdmin ? <span className="ml-auto">Click a cost to edit it in place</span> : null}
      </div>
    </div>
  );
}
