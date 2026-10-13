import { requireUser } from "@/lib/auth";
import { listProducts } from "@/lib/products";
import { mergeCategories } from "@/lib/categories";
import { PageHeader, LinkButton, Notice } from "@/components/ui";
import ProductsTable from "./products-table";

export const metadata = { title: "Products" };

export default async function ProductsPage({ searchParams }) {
  const { isAdmin } = await requireUser();
  const sp = await searchParams;
  const archived = sp.archived === "1";
  let products = [], error = null;
  try { products = await listProducts({ includeArchived: archived }); } catch (e) { error = e.message; }
  const categories = mergeCategories(products.map((p) => p.category));

  return (
    <div>
      <PageHeader
        title="Products"
        sub="Master list of warehouse codes, marketplace SKUs and costs"
        actions={isAdmin ? (
          <>
            <LinkButton href="/api/products/export" prefetch={false}>Export .xlsx</LinkButton>
            <LinkButton href="/products/import">Import</LinkButton>
            <LinkButton href="/products/new" variant="primary">New product</LinkButton>
          </>
        ) : <LinkButton href="/api/products/export" prefetch={false}>Export .xlsx</LinkButton>}
      />
      {error ? <Notice tone="bad">Couldn&apos;t load products: {error}</Notice> : (
        <ProductsTable products={products} categories={categories} isAdmin={isAdmin} archived={archived} initialFilter={sp.f || ""} initialQuery={sp.q || ""} />
      )}
    </div>
  );
}
