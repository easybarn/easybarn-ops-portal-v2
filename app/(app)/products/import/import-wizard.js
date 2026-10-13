"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { PageHeader, Panel, Button, LinkButton, Notice, Stat, Badge } from "@/components/ui";

const fmt = (v) => (v == null || v === "" ? <span className="text-faint">empty</span> : typeof v === "boolean" ? (v ? "yes" : "no") : String(v));

export default function ImportWizard() {
  const router = useRouter();
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function send(action) {
    if (!file) return;
    setBusy(true); setError("");
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`/api/products/import?action=${action}`, { method: "POST", body: fd });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setError(d.error || "Import failed"); return; }
    if (action === "preview") setPreview(d); else { setResult(d); setPreview(null); router.refresh(); }
  }

  return (
    <div>
      <PageHeader crumbs={[{ label: "Products", href: "/products" }, { label: "Import / export" }]} title="Import / export"
        sub="Upload your product spreadsheet, check the changes, then apply."
        actions={<LinkButton href="/api/products/export" prefetch={false}>Download current list (.xlsx)</LinkButton>} />

      <div className="grid gap-3 max-w-[1200px]">
        <Panel title="1 · Choose file">
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex items-center gap-2 h-[30px] px-3 border border-dashed border-line-strong rounded-[5px] cursor-pointer hover:bg-hover">
              <Upload size={14} />
              <span>{file ? file.name : "Choose .xlsx or .csv"}</span>
              <input type="file" accept=".xlsx,.xls,.csv" className="sr-only" onChange={(e) => { setFile(e.target.files?.[0] || null); setPreview(null); setResult(null); }} />
            </label>
            <Button variant="primary" onClick={() => send("preview")} disabled={!file || busy}>{busy && !preview ? "Reading…" : "Preview changes"}</Button>
            <span className="text-[12px] text-faint">First sheet is read. Needs a WAREHOUSE CODE column; matches your existing export format.</span>
          </div>
        </Panel>

        {error ? <Notice tone="bad">{error}</Notice> : null}
        {result ? (
          <Notice tone={result.errors?.length ? "warn" : "ok"}>
            Created {result.created}, updated {result.updated}.
            {result.errors?.length ? <> {result.errors.length} failed: {result.errors.map((e) => `${e.code} (${e.error})`).join("; ")}</> : null}
          </Notice>
        ) : null}

        {preview ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <Stat label="Rows in file" value={preview.summary.rows} />
              <Stat label="New" value={preview.summary.create} tone={preview.summary.create ? "ok" : undefined} />
              <Stat label="Changed" value={preview.summary.update} tone={preview.summary.update ? "warn" : undefined} />
              <Stat label="Unchanged" value={preview.summary.unchanged} />
            </div>
            {preview.summary.duplicates?.length ? <Notice tone="warn">Duplicate codes in the file (only the first is used): {preview.summary.duplicates.join(", ")}</Notice> : null}

            {preview.create.length ? (
              <Panel title={`New products · ${preview.create.length}`} pad={false}>
                <div className="overflow-auto max-h-[320px]">
                  <table className="tbl">
                    <thead><tr><th>Code</th><th>Description</th><th>Category</th><th>Shopify</th><th>Takealot</th><th>LM</th><th className="r">Cost</th></tr></thead>
                    <tbody>{preview.create.map((r) => (
                      <tr key={r.warehouse_code}><td className="num font-semibold">{r.warehouse_code}</td><td>{r.description}</td><td className="text-muted">{r.category || "—"}</td>
                        <td className="num text-[12px]">{r.shopify_sku || "—"}</td><td className="num text-[12px]">{r.takealot_sku || "—"}</td><td className="num text-[12px]">{r.leroymerlin_sku || "—"}</td><td className="r num">{r.cost_excl_vat ?? "—"}</td></tr>
                    ))}</tbody>
                  </table>
                </div>
              </Panel>
            ) : null}

            {preview.update.length ? (
              <Panel title={`Changes · ${preview.update.length}`} pad={false}>
                <div className="overflow-auto max-h-[420px]">
                  <table className="tbl">
                    <thead><tr><th>Code</th><th>Field</th><th>Now</th><th>After import</th></tr></thead>
                    <tbody>{preview.update.flatMap((u) => Object.entries(u.changes).map(([f, c], i) => (
                      <tr key={u.warehouse_code + f}>
                        <td className="num font-semibold">{i === 0 ? <>{u.warehouse_code} {u.reactivate ? <Badge>archived</Badge> : null}</> : ""}</td>
                        <td className="text-muted">{f}</td>
                        <td className="text-muted line-through decoration-faint">{fmt(c.from)}</td>
                        <td className="font-medium">{fmt(c.to)}</td>
                      </tr>
                    )))}</tbody>
                  </table>
                </div>
              </Panel>
            ) : null}

            <div className="flex gap-2">
              <Button variant="primary" onClick={() => send("apply")} disabled={busy || (!preview.create.length && !preview.update.length)}>
                {busy ? "Applying…" : `Apply ${preview.create.length + preview.update.length} changes`}
              </Button>
              <Button onClick={() => setPreview(null)} disabled={busy}>Cancel</Button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
