import { requireUser } from "@/lib/auth";

// Bare layout for printable pages (no sidebar)
export default async function PrintLayout({ children }) {
  await requireUser();
  return <main className="print-page">{children}</main>;
}
