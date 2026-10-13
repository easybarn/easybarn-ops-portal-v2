import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { listPos, STATUSES } from "@/lib/purchase-orders";
import { emailConfig } from "@/lib/po-email";
import { PageHeader, Notice, cx } from "@/components/ui";
import { zar } from "@/lib/format";
import PoTable from "./po-table";

export const metadata = { title: "Purchase orders" };

export default async function PosPage({ searchParams }) {
  await requireUser();
  const sp = await searchParams;
  let all = [], error = null;
  try { all = await listPos(); } catch (e) { error = e.message; }
  const queue = all.filter((p) => p.status === "draft");
  const status = STATUSES.includes(sp.status) ? sp.status : sp.status === "all" ? "" : queue.length ? "draft" : "";
  const pos = status ? all.filter((p) => p.status === status) : all;
  const open = all.filter((p) => p.status === "draft" || p.status === "sent");
  const { ready, to, cc } = emailConfig();
  const tabs = [["draft", `Send queue · ${queue.length}`], ["sent", "Sent"], ["complete", "Complete"], ["cancelled", "Cancelled"], ["all", "All"]];

  return (
    <div>
      <PageHeader title="Purchase orders" sub={`Doors Delivered (Pty) Ltd → Panel & Pane Joinery · ${open.length} open · ${zar(open.reduce((s, p) => s + p.incl, 0))} incl VAT`} />
      <div className="flex gap-1 bg-sunk p-0.5 rounded-md w-fit mb-3">
        {tabs.map(([k, l]) => {
          const active = (status || "all") === k;
          return <Link key={k} href={`/purchase-orders?status=${k}`} className={cx("h-[28px] px-3 rounded-[5px] flex items-center text-[13px]", active ? "bg-panel shadow-sm font-semibold" : "text-muted hover:text-ink", k === "draft" && queue.length && !active && "text-accent")}>{l}</Link>;
        })}
      </div>
      {error ? <Notice tone="bad">Couldn&apos;t load POs: {error}</Notice> : <PoTable key={status || "all"} pos={pos} email={{ ready, to, cc }} queueView={status === "draft"} />}
    </div>
  );
}
