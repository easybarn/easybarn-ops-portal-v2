import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { listShipments } from "@/lib/takealot";
import { PageHeader, Notice, Empty, Badge, cx, btnClass } from "@/components/ui";
import RefreshButton from "@/components/refresh-button";
import { DcBadge } from "../sales-table";
import TakealotProcess from "../process-help";
import { shortDate } from "@/lib/format";

export const metadata = { title: "Takealot shipments" };
const FILTERS = { open: ["Drafts & confirmed", false], shipped: ["Shipped", true], all: ["All", null] };
const STATE_TONE = { shipped: "ok", cancelled: "neutral", archived: "neutral", draft: "warn", confirmed: "info" };

export default async function ShipmentsPage({ searchParams }) {
  await requireUser();
  const sp = await searchParams;
  const f = FILTERS[sp.f] ? sp.f : "open";
  let rows = [], error = null;
  try { rows = await listShipments({ shipped: FILTERS[f][1] }); } catch (e) { error = e.message; }
  if (f === "open") rows = rows.filter((s) => s.state !== "cancelled" && s.state !== "archived");
  const now = new Date().toISOString();
  rows = rows.map((s) => ({ ...s, overdue: !s.shipped && !!s.dueDate && new Date(s.dueDate).toISOString() < now }));

  return (
    <div>
      <PageHeader crumbs={[{ label: "Takealot", href: "/takealot/shipments" }, { label: "Shipments" }]} title="Takealot shipments"
        sub="Booked in the Takealot seller portal (draft → confirmed → shipped). Open one to print the shipping note and labels."
        actions={<><TakealotProcess /><RefreshButton /><Link href="/takealot" className={btnClass()}>Sales</Link><a href="https://seller.takealot.com/shipments" target="_blank" rel="noreferrer" className={btnClass("primary")}>Manage in Takealot <ExternalLink size={12} /></a></>} />
      <div className="flex gap-1 bg-sunk p-0.5 rounded-md w-fit mb-3">
        {Object.entries(FILTERS).map(([k, [l]]) => (
          <Link key={k} href={`/takealot/shipments?f=${k}`} className={cx("h-[28px] px-3 rounded-[5px] flex items-center text-[13px]", f === k ? "bg-panel shadow-sm font-semibold" : "text-muted hover:text-ink")}>{l}</Link>
        ))}
      </div>
      {error ? <Notice tone="bad">Couldn&apos;t load shipments: {error}</Notice> : (
        <div className="bg-panel border border-line rounded-md">
          {rows.length ? (
            <table className="tbl">
              <thead><tr><th>Shipment</th><th>DC</th><th>Takealot PO</th><th>Due</th><th>Status</th><th>Tracking</th><th></th></tr></thead>
              <tbody>
                {rows.map((s) => {
                  const overdue = s.overdue;
                  return (
                    <tr key={s.id}>
                      <td><Link href={`/takealot/shipments/${s.id}`} className="num font-semibold hover:text-accent">{s.reference || s.id}</Link></td>
                      <td><DcBadge dc={s.dc} /></td>
                      <td className="num text-muted">{s.poNumber || "—"}</td>
                      <td className={cx("whitespace-nowrap", overdue ? "text-bad font-medium" : "text-muted")}>{s.dueDate ? shortDate(s.dueDate) : "—"}</td>
                      <td><Badge tone={STATE_TONE[s.state] || "info"}>{s.state}</Badge></td>
                      <td className="num text-[12px] text-muted">{s.tracking || "—"}</td>
                      <td className="r"><Link href={`/takealot/shipments/${s.id}`} className={btnClass("default", "sm")}>Print pack →</Link></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : <Empty>No shipments.</Empty>}
        </div>
      )}
    </div>
  );
}
