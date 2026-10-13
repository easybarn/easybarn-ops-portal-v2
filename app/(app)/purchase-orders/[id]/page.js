import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getPo, BUYER, SUPPLIER } from "@/lib/purchase-orders";
import { emailConfig } from "@/lib/po-email";
import PoEditor from "./po-editor";

export async function generateMetadata({ params }) {
  const po = await getPo((await params).id).catch(() => null);
  return { title: po?.po_number || "PO" };
}

export default async function PoPage({ params }) {
  const { isAdmin } = await requireUser();
  const po = await getPo((await params).id);
  if (!po) notFound();
  const { ready, to, cc } = emailConfig();
  return <PoEditor po={po} isAdmin={isAdmin} buyer={BUYER} supplier={SUPPLIER} email={{ ready, to, cc }} />;
}
