import Link from "next/link";
import { pickingSummary } from "@/lib/picking";
import PrintButton from "./print-button";

export const metadata = { title: "Picking summary" };

const fmt = (d) => new Date(d).toLocaleDateString("en-ZA", { day: "2-digit", month: "short", timeZone: "Africa/Johannesburg" });

function Header({ title, sub, now, count }) {
  return (
    <header className="flex items-end justify-between border-b-2 border-black pb-2 mb-4">
      <div>
        <h1 className="text-[20px] font-bold">{title}</h1>
        <div className="text-[12px] text-[#444]">{sub}</div>
      </div>
      <div className="text-right text-[12px]">
        <div>{now}</div>
        <div><b>{count}</b> orders</div>
      </div>
    </header>
  );
}

function Signoff() {
  return <div className="mt-8 flex gap-10 text-[11px]"><span>Checked by: ____________________</span><span>Date: ____________</span></div>;
}

function StockSection({ title, rows }) {
  if (!rows.length) return null;
  const units = rows.reduce((s, r) => s + r.qty, 0);
  return (
    <section className="mb-5">
      <h2 className="text-[13px] font-bold uppercase tracking-wide mb-1">{title} · {rows.length} lines · {units} units</h2>
      <table className="ptbl">
        <thead><tr><th style={{ width: 22 }}>✓</th><th style={{ width: 44, textAlign: "right" }}>Qty</th><th style={{ width: 70, textAlign: "right" }}>In stock</th><th>P&amp;P code</th><th>Description</th><th>Size</th><th>Orders</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.code}>
              <td><span className="box" /></td>
              <td style={{ textAlign: "right", fontWeight: 700, fontSize: 14 }} className="num">{r.qty}</td>
              <td style={{ textAlign: "right" }}><span style={{ display: "inline-block", width: 50, borderBottom: "1px solid #999" }}>&nbsp;</span></td>
              <td className="num" style={{ fontWeight: 700 }}>{r.code}</td>
              <td>{r.description}</td>
              <td className="num">{r.size || ""}</td>
              <td style={{ fontSize: 10.5, color: "#444" }}>{r.orders.join(", ")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function StockSlip({ data, now, scope }) {
  const orders = new Set([...data.doors, ...data.hardware].flatMap((l) => l.orders.map((o) => o.split(" ")[0])));
  return (
    <div>
      <Header title="Easy Barn · stock picking summary" sub={`${scope} · standard stock items · stock check`} now={now} count={orders.size} />
      {!data.doors.length && !data.hardware.length ? <p>No stock items to pick.</p> : null}
      <StockSection title="Doors" rows={data.doors} />
      <StockSection title="Hardware" rows={data.hardware} />
      {data.unmapped.length ? (
        <section className="mb-5">
          <h2 className="text-[13px] font-bold uppercase tracking-wide mb-1">Unmapped SKUs · fix in portal, then pick</h2>
          <table className="ptbl">
            <thead><tr><th style={{ width: 22 }}>✓</th><th style={{ width: 44, textAlign: "right" }}>Qty</th><th>Order</th><th>Item</th><th>Shopify SKU</th></tr></thead>
            <tbody>
              {data.unmapped.map((l, i) => (
                <tr key={i}><td><span className="box" /></td><td style={{ textAlign: "right", fontWeight: 700 }}>{l.qty}</td><td className="num">{l.order}</td><td>{l.title}{l.variant ? ` · ${l.variant}` : ""}</td><td className="num">{l.sku}</td></tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}
      {data.custom.length ? <p className="text-[11px] text-[#444]">+ {data.custom.reduce((s, o) => s + o.items.length, 0)} purpose-made lines on {data.custom.length} orders · see purpose-made slip</p> : null}
      <Signoff />
    </div>
  );
}

function CustomSlip({ data, now, scope }) {
  const lines = data.custom.reduce((s, o) => s + o.items.length, 0);
  const units = data.custom.reduce((s, o) => s + o.items.reduce((n, i) => n + i.qty, 0), 0);
  const blank = (w) => <span style={{ display: "inline-block", width: w, borderBottom: "1px solid #999" }}>&nbsp;</span>;
  return (
    <div>
      <Header title="Easy Barn · PURPOSE MADE picking slip" sub={`${scope} · made-to-measure items · ${lines} lines · ${units} units`} now={now} count={data.custom.length} />
      {!data.custom.length ? <p>No purpose-made items on open orders.</p> : data.custom.map((o, n) => (
        // One boxed card per order, kept together on a page
        <section key={o.name} style={{ border: "2px solid #111", borderRadius: 4, marginBottom: 18, breakInside: "avoid" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 14, flexWrap: "wrap", background: "#111", color: "#fff", padding: "6px 10px" }}>
            <span style={{ fontSize: 11, opacity: 0.7 }}>{n + 1}/{data.custom.length}</span>
            <span className="num" style={{ fontSize: 16, fontWeight: 700 }}>{o.name}</span>
            <span style={{ fontSize: 13, fontWeight: 600 }}>{o.customer}</span>
            <span style={{ fontSize: 11 }}>{o.city}</span>
            {o.phone ? <span className="num" style={{ fontSize: 11 }}>{o.phone}</span> : null}
            <span style={{ fontSize: 11, marginLeft: "auto" }}>Ordered {fmt(o.createdAt)}</span>
          </div>
          <table className="ptbl">
            <thead><tr><th style={{ width: 22 }}>✓</th><th style={{ width: 40, textAlign: "right" }}>Qty</th><th>Item · size / spec</th><th style={{ width: 70 }}>Made</th><th style={{ width: 70 }}>Checked</th></tr></thead>
            <tbody>
              {o.items.map((i, k) => (
                <tr key={k}>
                  <td><span className="box" /></td>
                  <td style={{ textAlign: "right", fontWeight: 700, fontSize: 15 }} className="num">{i.qty}</td>
                  <td>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{i.title}</div>
                    {i.variant ? <div className="num" style={{ fontSize: 12 }}>{i.variant}</div> : null}
                    {i.props?.length ? <div style={{ fontSize: 11, color: "#333" }}>{i.props.map((p) => `${p.key}: ${p.value}`).join(" · ")}</div> : null}
                  </td>
                  <td>{blank(56)}</td>
                  <td>{blank(56)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {o.note || o.alsoOnOrder.length ? (
            <div style={{ padding: "6px 10px", borderTop: "1px solid #bbb", background: "#f3f3f3", fontSize: 11.5, display: "grid", gap: 2 }}>
              {o.note ? <div><b>Note:</b> {o.note}</div> : null}
              {o.alsoOnOrder.length ? <div><b>Ships with:</b> {o.alsoOnOrder.join(", ")}</div> : null}
            </div>
          ) : null}
        </section>
      ))}
      <Signoff />
    </div>
  );
}

const VIEWS = [["all", "Both slips"], ["stock", "Stock only"], ["custom", "Purpose made only"]];

export default async function PickingSummary({ searchParams }) {
  const sp = await searchParams;
  const withPending = sp.pending === "1";
  const view = VIEWS.some(([v]) => v === sp.view) ? sp.view : "all";
  let data, error = null;
  try { data = await pickingSummary(withPending ? ["toship", "pending"] : ["toship"]); } catch (e) { error = e.message; }
  const now = new Date().toLocaleString("en-ZA", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Johannesburg" });
  const scope = withPending ? "Paid + awaiting payment" : "Paid, unshipped";
  const href = (o) => "/print/picking?" + new URLSearchParams({ view, ...(withPending ? { pending: "1" } : {}), ...o }).toString().replace(/pending=0&?/, "");

  return (
    <div className="max-w-[1000px] mx-auto">
      <div className="no-print flex flex-wrap items-center gap-3 mb-4 text-[13px]">
        <Link href="/orders" className="underline">← Orders</Link>
        <span className="ml-auto flex gap-1">
          {VIEWS.map(([v, l]) => (
            <Link key={v} href={href({ view: v })} className="px-2 py-1 rounded border" style={view === v ? { background: "#111", color: "#fff", borderColor: "#111" } : { borderColor: "#ccc" }}>{l}</Link>
          ))}
        </span>
        <Link href={href({ pending: withPending ? "0" : "1" })} className="underline">{withPending ? "Paid orders only" : "Include awaiting payment"}</Link>
        <PrintButton />
      </div>
      {error ? <p style={{ color: "#b42318" }}>Couldn&apos;t load orders: {error}</p> : data.orders.length === 0 ? <p>No orders waiting to ship.</p> : (
        <>
          {view !== "custom" ? <StockSlip data={data} now={now} scope={scope} /> : null}
          {view === "all" && data.custom.length ? <div style={{ breakBefore: "page", height: 32 }} className="no-print-gap" /> : null}
          {view !== "stock" && (view === "custom" || data.custom.length) ? <CustomSlip data={data} now={now} scope={scope} /> : null}
        </>
      )}
    </div>
  );
}
