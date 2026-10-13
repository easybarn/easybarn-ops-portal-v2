import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { tcgListShipments } from "@/lib/courier";
import { PageHeader, Notice, cx } from "@/components/ui";
import PrintQueue from "./print-queue";

export const metadata = { title: "Print queue" };
const RANGES = [[1, "Today"], [7, "7 days"], [30, "30 days"], [90, "90 days"]];

export default async function ShippingPage({ searchParams }) {
  await requireUser();
  const sp = await searchParams;
  const days = RANGES.some(([d]) => String(d) === sp.days) ? Number(sp.days) : 7;
  let shipments = [], error = null;
  try {
    shipments = await tcgListShipments(days);
    if (days === 1) {
      const start = new Date(); start.setHours(0, 0, 0, 0);
      shipments = shipments.filter((s) => new Date(s.createdAt) >= start);
    }
  } catch (e) { error = e.message; }

  return (
    <div>
      <PageHeader title="Print queue" sub="The Courier Guy shipments · batch print waybills and 6-up stickers" />
      <div className="flex gap-1 bg-sunk p-0.5 rounded-md w-fit mb-3">
        {RANGES.map(([d, l]) => (
          <Link key={d} href={`/shipping?days=${d}`} className={cx("h-[28px] px-3 rounded-[5px] flex items-center text-[13px]", days === d ? "bg-panel shadow-sm font-semibold" : "text-muted hover:text-ink")}>{l}</Link>
        ))}
      </div>
      {error ? <Notice tone="bad">Couldn&apos;t load shipments from The Courier Guy: {error}</Notice> : <PrintQueue shipments={shipments} />}
    </div>
  );
}
