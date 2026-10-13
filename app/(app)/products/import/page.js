import { requireAdmin } from "@/lib/auth";
import ImportWizard from "./import-wizard";

export const metadata = { title: "Import products" };

export default async function ImportPage() {
  await requireAdmin();
  return <ImportWizard />;
}
