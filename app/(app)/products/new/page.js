import { requireAdmin } from "@/lib/auth";
import { listCategories } from "@/lib/products";
import { mergeCategories } from "@/lib/categories";
import NewProductForm from "./new-product-form";

export const metadata = { title: "New product" };

export default async function NewProductPage() {
  await requireAdmin();
  return <NewProductForm categories={mergeCategories(await listCategories())} />;
}
