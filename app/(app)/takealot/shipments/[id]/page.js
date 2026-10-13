import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { loadShipment } from "@/lib/takealot";
import { PageHeader, Notice, Panel, Badge } from "@/components/ui";
import RefreshButton from "@/components/refresh-button";
import { ItemCode } from "../../../orders/order-bits";
import { DcBadge } from "../../sales-table";
import { shortDate } from "@/lib/format";
import PrintPack from "./print-pack";

export const metadata = { title: "Takealot shipment" };

export default async function ShipmentPage({ params }) {
  await requireUser();
  const { id } = await params;
  let s = null, error = null;
  try { s = await loadShipment(id); } catch (e) { if (/404/.test(e.message)) notFound(); error = e.message; }
  if (error) return <Notice tone="bad">Couldn&apos;t load shipment {id}: {error}</Notice>;

  const units = s.items.reduce((n, i) => n + i.sending, 0);
  return (
    <div>
      <PageHeader crumbs={[{ label: "Takealot shipments", href: "/takealot/shipments" }, { label: s.reference || String(s.id) }]}
        title={<span className="flex items-center gap-2"><span className="num">{s.reference}</span><DcBadge dc={s.dc} /><Badge tone={s.state === "shipped" ? "ok" : "warn"}>{s.state}</Badge></span>}
        sub={`Takealot PO ${s.poNumber || "—"} · due ${s.dueDate ? shortDate(s.dueDate) : "—"} · ${s.items.length} line${s.items.length === 1 ? "" : "s"} · ${units} unit${units === 1 ? "" : "s"}${s.tracking ? ` · tracking ${s.tracking}` : ""}`}
        actions={<RefreshButton />} />

      <PrintPack id={s.id} lines={s.items.length} units={units} />

      <Panel title="Items" pad={false} className="mt-3">
        <table className="tbl">
          <thead><tr><th className="r">Sending</th><th>P&amp;P code</th><th>Product</th><th>Takealot SKU</th><th>Barcode</th><th className="r">Received</th><th className="r">Damaged</th></tr></thead>
          <tbody>
            {s.items.map((i) => (
              <tr key={i.id}>
                <td className="r num font-semibold text-[14px]">{i.sending}</td>
                <td><ItemCode item={i} /></td>
                <td><div className="max-w-[360px] truncate" title={i.title}>{i.title}</div>{i.product?.size ? <div className="text-[11px] text-faint num">{i.product.size}</div> : null}</td>
                <td className="num text-muted">{i.sku || "—"}</td>
                <td className="num text-muted">{i.barcode || <span className="text-bad">missing</span>}</td>
                <td className="r num text-muted">{i.received ?? "—"}</td>
                <td className="r num text-muted">{i.damaged ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}
