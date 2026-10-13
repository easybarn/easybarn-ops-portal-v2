import Link from "next/link";
import { ClipboardList, Send } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { listOrders, listAllOrders, enrichOrders } from "@/lib/orders";
import { autoRaisePos } from "@/lib/auto-po";
import { listSlips } from "@/lib/slips";
import { createClient } from "@/lib/supabase-server";
import { STAGES } from "@/lib/pipeline";
import { PageHeader, Notice, cx } from "@/components/ui";
import OrdersTable from "./orders-table";
import RefreshButton from "@/components/refresh-button";
import ProcessHelp from "./process-help";

export const metadata = { title: "Shopify orders" };

const OTHER = { shipped: "Shipped" };

export default async function OrdersPage({ searchParams }) {
  const { user } = await requireUser();
  const sp = await searchParams;
  const view = STAGES.some((s) => s.key === sp.tab) || OTHER[sp.tab] ? sp.tab : null;
  const q = (sp.q || "").trim();

  let all = [], other = [], next = null, error = null, autoCreated = [], openSlips = [], queued = 0;
  try {
    // The pipeline always loads every paid, unshipped order so the stage counts are right
    all = await enrichOrders(await listAllOrders("toship"));
    autoCreated = await autoRaisePos(all, user.id);
    if (view === "shipped") {
      const r = await listOrders(view, { q, after: sp.after || null });
      other = await enrichOrders(r.orders);
      next = r.next;
    }
    // Only recent open slips in the "add to slip" list (old portal left many slips open)
    const recent = Date.now() - 14 * 864e5;
    openSlips = (await listSlips({ status: "open" })).filter((s) => new Date(s.created_at).getTime() > recent).map((s) => ({ id: s.id, number: s.slip_number, count: (s.order_refs || []).length }));
    const supabase = await createClient();
    const { count } = await supabase.from("purchase_orders").select("id", { count: "exact", head: true }).eq("status", "draft").gte("created_at", new Date(Date.now() - 14 * 864e5).toISOString());
    queued = count || 0;
  } catch (e) { error = e.message; }

  const counts = Object.fromEntries(STAGES.map((s) => [s.key, all.filter((o) => o.stage === s.key).length]));
  const tab = view || STAGES.find((s) => counts[s.key])?.key || "new";
  const match = (o) => !q || [o.name, o.customer.name, o.customer.email, ...o.items.map((i) => i.product?.code || i.sku)].some((v) => String(v || "").toLowerCase().includes(q.toLowerCase()));
  const rows = OTHER[tab] ? other : all.filter((o) => o.stage === tab && match(o));
  const qs = (o) => "/orders?" + new URLSearchParams(Object.fromEntries(Object.entries({ tab, q, ...o }).filter(([, v]) => v))).toString();

  return (
    <div>
      <PageHeader title="Shopify orders" sub="New order → PO to Panel & Pane → picking slip → ship"
        actions={<><RefreshButton /><Link href="/print/picking" target="_blank" className="inline-flex items-center gap-1.5 h-[30px] px-3 rounded-[5px] border border-line-strong bg-panel hover:bg-hover font-medium"><ClipboardList size={14} /> Picking summary</Link></>} />

      {autoCreated.length ? <div className="mb-2"><Notice tone="ok">New orders: raised {autoCreated.length} PO{autoCreated.length === 1 ? "" : "s"} automatically ({autoCreated.join(", ")}). They&apos;re in the send queue.</Notice></div> : null}
      {queued ? (
        <div className="mb-3"><Notice tone="warn">
          <span className="inline-flex items-center gap-2"><Send size={14} /> {queued} PO{queued === 1 ? "" : "s"} raised but not yet emailed to Panel &amp; Pane. <Link href="/purchase-orders?status=draft" className="underline font-medium">Open send queue →</Link></span>
        </Notice></div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="flex flex-wrap gap-1 bg-sunk p-0.5 rounded-md">
          {STAGES.map((s) => (
            <Link key={s.key} href={qs({ tab: s.key, after: null })} title={s.hint} className={cx("h-[28px] px-3 rounded-[5px] flex items-center gap-1.5 text-[13px]", tab === s.key ? "bg-panel shadow-sm font-semibold" : "text-muted hover:text-ink")}>
              {s.label}<span className={cx("num text-[11px] px-1.5 rounded", counts[s.key] ? "bg-accent text-accent-ink" : "bg-line text-muted")}>{counts[s.key]}</span>
            </Link>
          ))}
          <span className="w-px bg-line-strong mx-1" />
          {Object.entries(OTHER).map(([k, l]) => (
            <Link key={k} href={qs({ tab: k, after: null })} className={cx("h-[28px] px-3 rounded-[5px] flex items-center text-[13px]", tab === k ? "bg-panel shadow-sm font-semibold" : "text-muted hover:text-ink")}>{l}</Link>
          ))}
          <ProcessHelp />
        </div>
        <form action="/orders" className="flex gap-1.5 ml-auto">
          <input type="hidden" name="tab" value={tab} />
          <input name="q" defaultValue={q} placeholder="Filter: order, customer, P&P code" className="input !w-[260px]" />
          <button className="h-[30px] px-3 rounded-[5px] border border-line-strong bg-panel hover:bg-hover">Filter</button>
        </form>
      </div>
      {error ? <Notice tone="bad">Couldn&apos;t load orders: {error}</Notice> : (
        <OrdersTable key={tab} orders={rows} tab={tab} openSlips={openSlips} nextHref={next ? qs({ after: next }) : null} firstHref={sp.after ? qs({ after: null }) : null} />
      )}
    </div>
  );
}
