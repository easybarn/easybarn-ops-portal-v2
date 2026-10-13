import Link from "next/link";
import { ExternalLink, Package } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { listSales, enrichSales } from "@/lib/takealot";
import { PageHeader, Notice, cx, btnClass } from "@/components/ui";
import RefreshButton from "@/components/refresh-button";
import SalesTable from "./sales-table";
import TakealotProcess from "./process-help";

export const metadata = { title: "Takealot sales" };
const DAYS = [7, 30, 60, 90, 180];

export default async function TakealotPage({ searchParams }) {
  const { isAdmin } = await requireUser();
  const sp = await searchParams;
  const days = DAYS.includes(Number(sp.days)) ? Number(sp.days) : 90;
  const q = (sp.q || "").trim().toLowerCase();

  let sales = [], error = null;
  try { sales = await enrichSales(await listSales(days)); } catch (e) { error = e.message; }

  // Filter chips = Takealot's own sale statuses
  const statuses = [...new Set(sales.map((s) => s.status || "—"))].sort();
  const status = statuses.includes(sp.status) ? sp.status : "";
  const match = (s) => !q || [s.key, s.orderId, s.sku, s.title, s.customer, s.dc, s.status, s.shipmentName, s.poNumber, s.product?.code, s.po?.po_number].some((v) => String(v || "").toLowerCase().includes(q));
  const rows = sales.filter((s) => (!status || (s.status || "—") === status) && match(s));
  const qs = (o) => "/takealot?" + new URLSearchParams(Object.fromEntries(Object.entries({ days: days === 90 ? null : days, status, q: sp.q, ...o }).filter(([, v]) => v))).toString();
  const chip = (active) => cx("h-[26px] px-2.5 rounded-full border text-[12px] flex items-center gap-1.5", active ? "bg-accent text-accent-ink border-accent" : "border-line-strong text-muted hover:text-ink bg-panel");

  return (
    <div>
      <PageHeader title="Takealot lead-time sales" sub="Individual sales from Takealot. Shipments are booked in the Takealot seller portal; print their pack under Shipments."
        actions={<>
          <RefreshButton />
          <TakealotProcess />
          <Link href="/takealot/shipments" className={btnClass("primary")}><Package size={14} /> Shipments</Link>
          <a href="https://seller.takealot.com/shipments" target="_blank" rel="noreferrer" className={btnClass()}>Manage shipments <ExternalLink size={12} /></a>
          {isAdmin ? <a href="https://seller.takealot.com/sales" target="_blank" rel="noreferrer" className={btnClass()}>Sales report <ExternalLink size={12} /></a> : null}
        </>} />

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="flex flex-wrap gap-1.5">
          <Link href={qs({ status: null })} className={chip(!status)}>All <span className="num opacity-80">{sales.length}</span></Link>
          {statuses.map((st) => (
            <Link key={st} href={qs({ status: st })} className={chip(status === st)}>{st} <span className="num opacity-80">{sales.filter((s) => (s.status || "—") === st).length}</span></Link>
          ))}
        </div>
        <form action="/takealot" className="flex gap-1.5 ml-auto">
          {status ? <input type="hidden" name="status" value={status} /> : null}
          <select name="days" defaultValue={days} className="input !w-auto" aria-label="Period">
            {DAYS.map((d) => <option key={d} value={d}>Last {d} days</option>)}
          </select>
          <input name="q" defaultValue={sp.q || ""} placeholder="Search SKU, customer, status, PO" className="input !w-[240px]" />
          <button className="h-[30px] px-3 rounded-[5px] border border-line-strong bg-panel hover:bg-hover">Go</button>
        </form>
      </div>

      {error ? <Notice tone="bad">Couldn&apos;t load Takealot sales: {error}</Notice> : <SalesTable sales={rows} isAdmin={isAdmin} />}
    </div>
  );
}
