import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { loadSlip } from "@/lib/slip-view";
import SlipView from "./slip-view";

export async function generateMetadata() { return { title: "Picking slip" }; }

export default async function SlipPage({ params }) {
  await requireUser();
  const data = await loadSlip((await params).id);
  if (!data) notFound();
  return <SlipView data={data} />;
}
