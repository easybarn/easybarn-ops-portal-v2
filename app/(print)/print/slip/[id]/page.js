import { notFound } from "next/navigation";
import Link from "next/link";
import { loadSlip } from "@/lib/slip-view";
import PrintButton from "../../picking/print-button";

export const metadata = { title: "Print picking slip" };
const blank = (w) => <span style={{ display: "inline-block", width: w, borderBottom: "1px solid #999" }}>&nbsp;</span>;

export default async function PrintSlip({ params }) {
  const { id } = await params;
  const data = await loadSlip(id);
  if (!data) notFound();
  const { slip, orders, pickList } = data;
  const now = new Date().toLocaleString("en-ZA", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Johannesburg" });
  const units = pickList.reduce((s, g) => s + g.qty, 0);

  return (
    <div className="max-w-[1000px] mx-auto">
      <div className="no-print flex items-center gap-3 mb-4 text-[13px]">
        <Link href={`/picking-slips/${slip.id}`} className="underline">← {slip.slip_number}</Link>
        <span className="ml-auto" /><PrintButton />
      </div>
      <header className="flex items-end justify-between border-b-2 border-black pb-2 mb-4">
        <div>
          <h1 className="text-[22px] font-bold">Picking slip <span className="num">{slip.slip_number}</span></h1>
          <div className="text-[12px] text-[#444]">Easy Barn · Shopify · {orders.length} orders · {pickList.length} lines · {units} units</div>
        </div>
        <div className="text-right text-[12px]">{now}</div>
      </header>

      <h2 className="text-[13px] font-bold uppercase tracking-wide mb-1">1 · Pick from shelf</h2>
      <table className="ptbl mb-6">
        <thead><tr><th style={{ width: 22 }}>✓</th><th style={{ width: 44, textAlign: "right" }}>Qty</th><th>P&amp;P code</th><th>Description</th><th>Size</th><th>Orders</th></tr></thead>
        <tbody>
          {pickList.map((g) => (
            <tr key={g.code}>
              <td><span className="box" /></td>
              <td className="num" style={{ textAlign: "right", fontWeight: 700, fontSize: 15 }}>{g.qty}</td>
              <td className="num" style={{ fontWeight: 700 }}>{g.code}</td>
              <td>{g.description}</td>
              <td className="num">{g.size}</td>
              <td style={{ fontSize: 10.5, color: "#444" }}>{g.orders.join(", ")}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 className="text-[13px] font-bold uppercase tracking-wide mb-2">2 · Sort into orders</h2>
      {orders.map((o, n) => (
        <section key={o.key} style={{ border: "2px solid #111", borderRadius: 4, marginBottom: 14, breakInside: "avoid" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 14, flexWrap: "wrap", background: "#111", color: "#fff", padding: "5px 10px" }}>
            <span style={{ fontSize: 11, opacity: 0.7 }}>{n + 1}/{orders.length}</span>
            <span className="num" style={{ fontSize: 15, fontWeight: 700 }}>{o.name}</span>
            <span style={{ fontSize: 13, fontWeight: 600 }}>{o.customer.name}</span>
            <span style={{ fontSize: 11 }}>{[o.address?.city, o.address?.provinceCode].filter(Boolean).join(", ")}</span>
            {o.po ? <span className="num" style={{ fontSize: 11, marginLeft: "auto" }}>{o.po.po_number}</span> : null}
          </div>
          <table className="ptbl">
            <thead><tr><th style={{ width: 22 }}>✓</th><th style={{ width: 40, textAlign: "right" }}>Qty</th><th style={{ width: 120 }}>Code</th><th>Item</th></tr></thead>
            <tbody>
              {o.items.map((i) => (
                <tr key={i.key}>
                  <td><span className="box" /></td>
                  <td className="num" style={{ textAlign: "right", fontWeight: 700 }}>{i.qty}</td>
                  <td className="num" style={{ fontWeight: 700 }}>{i.product?.code || (i.sku ? `? ${i.sku}` : "PURPOSE MADE")}</td>
                  <td>{i.title}{i.variant ? ` · ${i.variant}` : ""}{i.props?.length ? <div style={{ fontSize: 10.5 }}>{i.props.map((p) => `${p.key}: ${p.value}`).join(" · ")}</div> : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ padding: "5px 10px", borderTop: "1px solid #bbb", background: "#f3f3f3", fontSize: 11, display: "flex", gap: 18, flexWrap: "wrap" }}>
            {o.note ? <span><b>Note:</b> {o.note}</span> : null}
            <span style={{ marginLeft: "auto" }}>Packed by {blank(90)}</span><span>Parcels {blank(30)}</span>
          </div>
        </section>
      ))}
      <div className="mt-6 flex gap-10 text-[11px]"><span>Picked by: ____________________</span><span>Checked by: ____________________</span><span>Date: ____________</span></div>
    </div>
  );
}
