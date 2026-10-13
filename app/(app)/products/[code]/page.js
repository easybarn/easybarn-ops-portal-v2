import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getProduct, getCostHistory, listAliases, listCategories } from "@/lib/products";
import { mergeCategories } from "@/lib/categories";
import ProductEditor from "./product-editor";

export async function generateMetadata({ params }) {
  const { code } = await params;
  return { title: decodeURIComponent(code) };
}

export default async function ProductPage({ params }) {
  const { isAdmin } = await requireUser();
  const code = decodeURIComponent((await params).code);
  const product = await getProduct(code);
  if (!product) notFound();
  const [history, aliases, cats] = await Promise.all([getCostHistory(code), listAliases(code), listCategories()]);
  return <ProductEditor product={product} history={history} aliases={aliases} categories={mergeCategories(cats)} isAdmin={isAdmin} />;
}
