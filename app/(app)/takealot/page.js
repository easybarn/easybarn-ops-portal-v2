import Link from "next/link";
import { ExternalLink, Package } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { listSales, enrichSales } from "@/lib/takealot";
import { TAL_STAGES, TAL_OTHER, talTab } from "@/lib/takealot-stages";
import { PageHeader, Notice, cx, btnClass } from "@/components/ui";
import RefreshButton from "@/components/refresh-button";
import SalesTable from "./sales-table";

export const metadata = { title: "Takealot orders" };
const DAYS = [30, 60, 90, 180];

export default async function TakealotPage({ searchParams }) {
  const { isAdmin } = await requireUser();
  const sp = await searchParams;
  const days = DAYS.includes(Number(sp.days)) ? Number(sp.days) : 60;
  const q = (sp.q || "").trim().toLowerCase();

  let sales = [], error = null;
  try { sales = (await enrichSales(await listSales(days))).map((s) => ({ ...s, tab: talTab(s) })); }
  catch (e) { error = e.message; }

  const keys = [...TAL_STAGES.map((s) => s.key), ...Object.keys(TAL_OTHER)];
  const counts = Object.fromEntries(keys.map((k) => [k, sales.filter((s) => s.tab === k).length]));
  const tab = keys.includes(sp.tab) ? sp.tab : TAL_STAGES.find((s) => counts[s.key])?.key || "new";
  const match = (s) => [s.key, s.orderId, s.name, s.sku, s.title, s.customer, s.dc, s.shipmentName, s.product?.code, s.po?.po_number].some((v) => String(v || "").toLowerCase().includes(q));
  const rows = q ? sales.filter(match) : sales.filter((s) => s.tab === tab);
  const qs = (o) => "/takealot?" + new URLSearchParams(Object.fromEntries(Object.entries({ tab, days: days === 60 ? null : days, q: sp.q, ...o }).filter(([, v]) => v))).toString();

  return (
    <div>
      <PageHeader title="Takealot lead-time orders" sub="New sale → PO to Panel & Pane → print pack and deliver to the Takealot DC"
        actions={<>
          <RefreshButton />
          <Link href="/takealot/shipments" className={btnClass()}><Package size={14} /> Shipments</Link>
          <a href="https://seller.takealot.com/shipments" target="_blank" rel="noreferrer" className={btnClass()}>Seller portal <ExternalLink size={12} /></a>
        </>} />

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="flex flex-wrap gap-1 bg-sunk p-0.5 rounded-md">
          {TAL_STAGES.map((s) => (
            <Link key={s.key} href={qs({ tab: s.key, q: null })} title={s.hint} className={cx("h-[28px] px-3 rounded-[5px] flex items-center gap-1.5 text-[13px]", !q && tab === s.key ? "bg-panel shadow-sm font-semibold" : "text-muted hover:text-ink")}>
              {s.label}<span className={cx("num text-[11px] px-1.5 rounded", counts[s.key] ? "bg-accent text-accent-ink" : "bg-line text-muted")}>{counts[s.key]}</span>
            </Link>
          ))}
          <span className="w-px bg-line-strong mx-1" />
          {Object.entries(TAL_OTHER).map(([k, l]) => (
            <Link key={k} href={qs({ tab: k, q: null })} className={cx("h-[28px] px-3 rounded-[5px] flex items-center gap-1.5 text-[13px]", !q && tab === k ? "bg-panel shadow-sm font-semibold" : "text-muted hover:text-ink")}>{l}<span className="num text-[11px] text-faint">{counts[k]}</span></Link>
          ))}
        </div>
        <form action="/takealot" className="flex gap-1.5 ml-auto">
          <input type="hidden" name="tab" value={tab} />
          <select name="days" defaultValue={days} className="input !w-auto" aria-label="Period">
            {DAYS.map((d) => <option key={d} value={d}>Last {d} days</option>)}
          </select>
          <input name="q" defaultValue={sp.q || ""} placeholder="Search all: order, SKU, P&P code, PO" className="input !w-[250px]" />
          <button className="h-[30px] px-3 rounded-[5px] border border-line-strong bg-panel hover:bg-hover">Go</button>
        </form>
      </div>

      {q ? <div className="mb-2 text-[12px] text-muted">{rows.length} match{rows.length === 1 ? "" : "es"} for “{sp.q}” across all tabs · <Link href={qs({ q: null })} className="text-accent hover:underline">clear</Link></div> : null}
      {error ? <Notice tone="bad">Couldn&apos;t load Takealot sales: {error}</Notice> : <SalesTable key={tab + q} sales={rows} tab={q ? "search" : tab} isAdmin={isAdmin} />}
    </div>
  );
}
