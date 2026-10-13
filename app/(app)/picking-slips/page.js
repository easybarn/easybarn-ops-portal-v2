import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { listSlips, OPEN_STATUSES } from "@/lib/slips";
import { PageHeader, Notice, Badge, Empty, cx } from "@/components/ui";
import { shortDate, ago } from "@/lib/format";

export const metadata = { title: "Picking slips" };
const TONE = { created: "warn", draft: "warn", picking: "warn", picked: "info", booking: "info", complete: "ok", cancelled: "neutral" };

export default async function SlipsPage({ searchParams }) {
  await requireUser();
  const sp = await searchParams;
  const filter = ["open", "picked", "complete", "cancelled", "all"].includes(sp.status) ? sp.status : "open";
  let slips = [], error = null;
  try { slips = await listSlips({ status: filter === "all" ? undefined : filter }); } catch (e) { error = e.message; }

  return (
    <div>
      <PageHeader title="Picking slips" sub="Batch orders with POs raised, pick them, then ship" />
      <div className="flex gap-1 bg-sunk p-0.5 rounded-md w-fit mb-3">
        {[["open", "Open"], ["picked", "Picked"], ["complete", "Complete"], ["cancelled", "Cancelled"], ["all", "All"]].map(([k, l]) => (
          <Link key={k} href={`/picking-slips?status=${k}`} className={cx("h-[28px] px-3 rounded-[5px] flex items-center text-[13px]", filter === k ? "bg-panel shadow-sm font-semibold" : "text-muted hover:text-ink")}>{l}</Link>
        ))}
      </div>
      {error ? <Notice tone="bad">{error}</Notice> : (
        <div className="bg-panel border border-line rounded-md">
          {slips.length ? (
            <table className="tbl">
              <thead><tr><th>Slip</th><th>Status</th><th className="r">Orders</th><th>Orders</th><th className="r">Lines picked</th><th>Waybills</th><th>Created</th></tr></thead>
              <tbody>
                {slips.map((s) => {
                  const st = s.pick_state || {};
                  const picked = Object.entries(st).filter(([k, v]) => k.split(":").length > 2 && v?.picked).length;
                  return (
                    <tr key={s.id}>
                      <td><Link href={`/picking-slips/${s.id}`} className="num font-semibold hover:text-accent">{s.slip_number}</Link></td>
                      <td><Badge tone={TONE[s.status] || "neutral"}>{OPEN_STATUSES.includes(s.status) ? "picking" : s.status}</Badge></td>
                      <td className="r num">{(s.order_refs || []).length}</td>
                      <td className="text-[12px] text-muted max-w-[360px] truncate num">{(s.order_refs || []).map((r) => (r.marketplace === "shopify" ? "#" : r.marketplace + " ") + r.order_id).join(", ")}</td>
                      <td className="r num">{picked}</td>
                      <td className="num text-[12px]">{(s.waybill_refs || []).join(", ") || "—"}</td>
                      <td className="text-muted whitespace-nowrap" title={shortDate(s.created_at)}>{ago(s.created_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : <Empty>No {filter === "all" ? "" : filter} picking slips. Create one from Shopify orders → “PO raised”.</Empty>}
        </div>
      )}
    </div>
  );
}
