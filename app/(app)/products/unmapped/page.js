import { requireAdmin } from "@/lib/auth";
import { listUnknownSkus, listProducts } from "@/lib/products";
import { PageHeader, Notice } from "@/components/ui";
import UnmappedTable from "./unmapped-table";

export const metadata = { title: "Unmapped SKUs" };

export default async function UnmappedPage() {
  await requireAdmin();
  let skus = [], products = [], error = null;
  try { [skus, products] = await Promise.all([listUnknownSkus(), listProducts()]); } catch (e) { error = e.message; }
  return (
    <div>
      <PageHeader crumbs={[{ label: "Products", href: "/products" }, { label: "Unmapped SKUs" }]} title="Unmapped SKUs"
        sub="Marketplace SKUs seen on orders that don't match any product. Map each one to a warehouse code." />
      {error ? <Notice tone="bad">{error}</Notice> : (
        <UnmappedTable skus={skus} products={products.map((p) => ({ code: p.warehouse_code, label: `${p.warehouse_code} — ${p.description}${p.size ? " · " + p.size : ""}` }))} />
      )}
    </div>
  );
}
