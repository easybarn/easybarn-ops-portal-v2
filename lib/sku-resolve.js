import "server-only";
import { createClient } from "@/lib/supabase-server";
import { MARKETPLACES } from "@/lib/categories";

// Resolve marketplace SKUs to products (primary column first, then aliases).
// Unresolved real SKUs are logged to unknown_skus so they show on the Unmapped page.
// refs: [{ marketplace, sku }]  →  Map("marketplace:sku" → product | null)
export async function resolveSkus(refs, { log = true } = {}) {
  const supabase = await createClient();
  const out = new Map();
  const byMp = {};
  for (const r of refs) {
    const sku = String(r.sku || "").trim();
    if (!sku || !MARKETPLACES[r.marketplace]) continue;
    (byMp[r.marketplace] ||= new Set()).add(sku);
  }

  for (const [mp, set] of Object.entries(byMp)) {
    const skus = [...set];
    const col = MARKETPLACES[mp].col;
    const { data: prim } = await supabase.from("products").select("*").in(col, skus).eq("active", true);
    for (const p of prim || []) out.set(`${mp}:${p[col]}`, p);

    const missing = skus.filter((s) => !out.has(`${mp}:${s}`));
    if (missing.length) {
      const { data: aliases } = await supabase.from("product_sku_aliases").select("sku, warehouse_code").eq("marketplace", mp).in("sku", missing);
      const codes = [...new Set((aliases || []).map((a) => a.warehouse_code))];
      if (codes.length) {
        const { data: prods } = await supabase.from("products").select("*").in("warehouse_code", codes).eq("active", true);
        const byCode = new Map((prods || []).map((p) => [p.warehouse_code, p]));
        for (const a of aliases || []) if (byCode.has(a.warehouse_code)) out.set(`${mp}:${a.sku}`, byCode.get(a.warehouse_code));
      }
    }
    for (const s of skus) if (!out.has(`${mp}:${s}`)) out.set(`${mp}:${s}`, null);
  }

  if (log) {
    const unknown = [...out.entries()].filter(([, v]) => !v).map(([k]) => { const i = k.indexOf(":"); return { marketplace: k.slice(0, i), sku: k.slice(i + 1) }; });
    for (const u of unknown) {
      try {
        const { data: ex } = await supabase.from("unknown_skus").select("id, resolved").eq("marketplace", u.marketplace).eq("sku", u.sku).maybeSingle();
        // Only touch the row when it's new or was resolved before — avoids counting every page view
        if (!ex) await supabase.from("unknown_skus").insert({ ...u, occurrence_count: 1, resolved: false });
        else if (ex.resolved) await supabase.from("unknown_skus").update({ resolved: false, last_seen_at: new Date().toISOString() }).eq("id", ex.id);
      } catch {}
    }
  }
  return out;
}
