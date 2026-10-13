import "server-only";
import { createClient } from "@/lib/supabase-server";
import { MARKETPLACES } from "@/lib/categories";

// Product master: one row per warehouse_code (the P&P pick code).
// Marketplace SKUs live on the row (primary) plus product_sku_aliases (extra/legacy SKUs).

export const EDITABLE = [
  "nickname", "description", "size", "category",
  "shopify_sku", "takealot_sku", "leroymerlin_sku",
  "cost_excl_vat", "free_issue", "notes", "active",
];

// Keep only known columns and normalise blanks → null
export function cleanProduct(input) {
  const out = {};
  for (const k of EDITABLE) {
    if (!(k in input)) continue;
    let v = input[k];
    if (typeof v === "string") v = v.trim();
    if (k === "cost_excl_vat") v = v === "" || v == null ? null : Number(v);
    else if (k === "free_issue" || k === "active") v = !!v;
    else if (v === "") v = null;
    out[k] = v;
  }
  if (out.cost_excl_vat != null && (isNaN(out.cost_excl_vat) || out.cost_excl_vat < 0)) {
    throw new Error("Cost must be a positive number");
  }
  return out;
}

export async function listProducts({ includeArchived = false } = {}) {
  const supabase = await createClient();
  let q = supabase.from("products").select("*").order("warehouse_code");
  if (!includeArchived) q = q.eq("active", true);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data || [];
}

export async function getProduct(code) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("products").select("*").eq("warehouse_code", code).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function listCategories() {
  const supabase = await createClient();
  const { data } = await supabase.from("products").select("category").not("category", "is", null);
  return [...new Set((data || []).map((r) => r.category))].sort();
}

export async function createProduct(input, userId) {
  const code = String(input.warehouse_code || "").trim().toUpperCase();
  if (!code) throw new Error("Warehouse code is required");
  const row = cleanProduct(input);
  if (!row.description) throw new Error("Description is required");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .insert({ ...row, warehouse_code: code, active: true, updated_by: userId })
    .select()
    .single();
  if (error) throw new Error(error.code === "23505" ? `${code} already exists` : error.message);
  return data;
}

export async function updateProduct(code, input, userId) {
  const row = cleanProduct(input);
  if ("description" in row && !row.description) throw new Error("Description can't be empty");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .update({ ...row, updated_by: userId })
    .eq("warehouse_code", code)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function getCostHistory(code) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("product_cost_history")
    .select("*")
    .eq("warehouse_code", code)
    .order("effective_from", { ascending: false });
  return data || [];
}

// ---------- aliases ----------
export async function listAliases(code) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("product_sku_aliases")
    .select("*")
    .eq("warehouse_code", code)
    .order("created_at", { ascending: false });
  return data || [];
}

export async function deleteAlias(id) {
  const supabase = await createClient();
  const { error } = await supabase.from("product_sku_aliases").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// Map a marketplace SKU onto a product: fills the primary column if empty,
// otherwise stores it as an alias. Also closes any matching unknown_skus row.
export async function mapSku(code, marketplace, sku, userId, note) {
  const mp = MARKETPLACES[marketplace];
  sku = String(sku || "").trim();
  if (!mp) throw new Error("Unknown marketplace");
  if (!sku) throw new Error("SKU is required");
  const supabase = await createClient();
  const product = await getProduct(code);
  if (!product) throw new Error(`Product ${code} not found`);

  let method;
  if (product[mp.col] === sku) {
    method = "already_primary";
  } else {
    const { data: existing } = await supabase
      .from("product_sku_aliases")
      .select("id, warehouse_code")
      .eq("marketplace", marketplace)
      .eq("sku", sku)
      .maybeSingle();
    if (existing && existing.warehouse_code !== code) {
      throw new Error(`${sku} is already mapped to ${existing.warehouse_code}`);
    }
    if (existing) method = "already_alias";
    else if (!product[mp.col]) {
      const { error } = await supabase.from("products").update({ [mp.col]: sku, updated_by: userId }).eq("warehouse_code", code);
      if (error) throw new Error(error.message);
      method = "primary_set";
    } else {
      const { error } = await supabase.from("product_sku_aliases").insert({
        warehouse_code: code, marketplace, sku, created_by: userId,
        note: note || `Mapped in portal ${new Date().toISOString().slice(0, 10)}`,
      });
      if (error) throw new Error(error.message);
      method = "alias_added";
    }
  }
  await supabase.from("unknown_skus").update({ resolved: true, resolved_to: code }).eq("marketplace", marketplace).eq("sku", sku);
  return { method };
}

// ---------- unknown SKUs ----------
export async function listUnknownSkus() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("unknown_skus")
    .select("*")
    .eq("resolved", false)
    .order("last_seen_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data || [];
}

export async function dismissUnknownSku(id) {
  const supabase = await createClient();
  const { error } = await supabase.from("unknown_skus").update({ resolved: true, resolved_to: null }).eq("id", id);
  if (error) throw new Error(error.message);
}

// ---------- spreadsheet import ----------
function deriveCategory(code) {
  const c = String(code || "").toUpperCase();
  if (c.startsWith("BFOLD") || c.startsWith("BARN F")) return "BARN FOLD";
  if (c.startsWith("BARN")) return "BARN";
  if (c.startsWith("BF")) return "BIFOLD";
  if (c.startsWith("HARD")) return "BARN HARDWARE";
  if (/^(BBI|BBC|BBL|BBF|BLE)/.test(c)) return "HARDWARE";
  return null;
}

export function normaliseImportRow(row) {
  const get = (...keys) => {
    for (const k of keys) {
      const v = row[k];
      if (v !== undefined && v !== null && String(v).trim() !== "") return String(v).trim();
    }
    return null;
  };
  const code = get("WAREHOUSE CODE", "warehouse_code");
  if (!code) return null;
  const cost = get("COST EXCL VAT", "cost_excl_vat");
  const free = (get("FREE ISSUE", "free_issue") || "").toLowerCase();
  return {
    warehouse_code: code.toUpperCase(),
    nickname: get("NICKNAME", "nickname"),
    description: get("WAREHOUSE DOOR DESCRIPTION", "DESCRIPTION", "description") || code,
    size: get("SIZE", "size"),
    category: get("CATEGORY", "category") || deriveCategory(code),
    shopify_sku: get("SHOPIFY SKU CODE", "SHOPIFY SKU", "shopify_sku"),
    takealot_sku: get("TAKEALOT SKU", "takealot_sku"),
    leroymerlin_sku: get("LEROY MERLIN CODE", "LEROY MERLIN SKU", "leroymerlin_sku"),
    cost_excl_vat: cost != null && !isNaN(parseFloat(cost.replace(/[R\s,]/g, ""))) ? parseFloat(cost.replace(/[R\s,]/g, "")) : null,
    free_issue: free === "yes" || free === "true" || free === "y",
    notes: get("NOTES", "notes"),
  };
}

const DIFF_FIELDS = ["nickname", "description", "size", "category", "shopify_sku", "takealot_sku", "leroymerlin_sku", "cost_excl_vat", "free_issue", "notes"];

export function diffImport(incoming, current) {
  const byCode = new Map(current.map((p) => [p.warehouse_code, p]));
  const seen = new Set();
  const create = [], update = [], unchanged = [], duplicates = [];
  for (const row of incoming) {
    if (seen.has(row.warehouse_code)) { duplicates.push(row.warehouse_code); continue; }
    seen.add(row.warehouse_code);
    const ex = byCode.get(row.warehouse_code);
    if (!ex) { create.push(row); continue; }
    const changes = {};
    for (const f of DIFF_FIELDS) {
      const a = ex[f] ?? null, b = row[f] ?? null;
      const same = f === "cost_excl_vat" ? (a == null && b == null) || (a != null && b != null && Number(a) === Number(b))
        : f === "free_issue" ? !!a === !!b
        : String(a ?? "") === String(b ?? "");
      if (!same) changes[f] = { from: a, to: b };
    }
    if (Object.keys(changes).length) update.push({ warehouse_code: row.warehouse_code, changes, row, reactivate: !ex.active });
    else unchanged.push(row.warehouse_code);
  }
  return { create, update, unchanged, duplicates };
}
