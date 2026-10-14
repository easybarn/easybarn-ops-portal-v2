import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { listLmOrders, enrichLmOrders, LM_TABS, LM_PORTAL } from "@/lib/leroymerlin";
import { PageHeader, Notice, cx, btnClass } from "@/components/ui";
import RefreshButton from "@/components/refresh-button";
import LmTable from "./lm-table";
import LmProcess from "./process-help";

export const metadata = { title: "Leroy Merlin orders" };
const DAYS = [7, 30, 90, 180];

export default async function LeroyMerlinPage({ searchParams }) {
  const { isAdmin } = await requireUser();
  const sp = await searchParams;
  const days = DAYS.includes(Number(sp.days)) ? Number(sp.days) : 90;
  const q = (sp.q || "").trim().toLowerCase();

  let orders = [], error = null;
  try { orders = await enrichLmOrders(await listLmOrders(days)); } catch (e) { error = e.message; }

  const tabOf = (o) => Object.keys(LM_TABS).find((k) => LM_TABS[k].states.includes(o.state)) || "other";
  const counts = Object.fromEntries(Object.keys(LM_TABS).map((k) => [k, orders.filter((o) => tabOf(o) === k).length]));
  const tab = LM_TABS[sp.tab] ? sp.tab : counts.action || !counts.accepted ? "action" : "accepted";
  const match = (o) => [o.id, o.customer.name, o.status, o.address?.city, o.po?.po_number, ...o.items.flatMap((i) => [i.sku, i.title, i.product?.code])].some((v) => String(v || "").toLowerCase().includes(q));
  const rows = q ? orders.filter(match) : orders.filter((o) => tabOf(o) === tab);
  const qs = (o) => "/leroy-merlin?" + new URLSearchParams(Object.fromEntries(Object.entries({ tab, days: days === 90 ? null : days, q: sp.q, ...o }).filter(([, v]) => v))).toString();

  return (
    <div>
      <PageHeader title="Leroy Merlin orders" sub="Mirakl marketplace. Ship from here: The Courier Guy is booked and the tracking goes back to Leroy Merlin automatically."
        actions={<>
          <LmProcess />
          <RefreshButton />
          <a href={LM_PORTAL} target="_blank" rel="noreferrer" className={btnClass()}>Open LM portal <ExternalLink size={12} /></a>
        </>} />

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="flex flex-wrap gap-1 bg-sunk p-0.5 rounded-md">
          {Object.entries(LM_TABS).map(([k, t]) => (
            <Link key={k} href={qs({ tab: k, q: null })} title={t.hint} className={cx("h-[28px] px-3 rounded-[5px] flex items-center gap-1.5 text-[13px]", !q && tab === k ? "bg-panel shadow-sm font-semibold" : "text-muted hover:text-ink")}>
              {t.label}<span className={cx("num text-[11px] px-1.5 rounded", (k === "action" || k === "accepted") && counts[k] ? "bg-accent text-accent-ink" : "bg-line text-muted")}>{counts[k]}</span>
            </Link>
          ))}
        </div>
        <form action="/leroy-merlin" className="flex gap-1.5 ml-auto">
          <input type="hidden" name="tab" value={tab} />
          <select name="days" defaultValue={days} className="input !w-auto" aria-label="Period">
            {DAYS.map((d) => <option key={d} value={d}>Last {d} days</option>)}
          </select>
          <input name="q" defaultValue={sp.q || ""} placeholder="Search order, customer, SKU, PO" className="input !w-[240px]" />
          <button className="h-[30px] px-3 rounded-[5px] border border-line-strong bg-panel hover:bg-hover">Go</button>
        </form>
      </div>
      {q ? <div className="mb-2 text-[12px] text-muted">{rows.length} match{rows.length === 1 ? "" : "es"} for “{sp.q}” · <Link href={qs({ q: null })} className="text-accent hover:underline">clear</Link></div> : null}
      {error ? <Notice tone="bad">Couldn&apos;t load Leroy Merlin orders: {error}</Notice> : <LmTable key={tab + q} orders={rows} isAdmin={isAdmin} tab={q ? "search" : tab} />}
    </div>
  );
}
