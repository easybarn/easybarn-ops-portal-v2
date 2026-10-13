import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getOrderByName, enrichOrders } from "@/lib/orders";
import { PageHeader, Panel, Badge, Notice } from "@/components/ui";
import { zar, shortDate, withVat } from "@/lib/format";
import { PayBadge, ItemCode, Pipeline } from "../order-bits";
import OrderActions, { TrackingRow } from "./order-actions";

export async function generateMetadata({ params }) {
  return { title: "#" + (await params).key };
}

export default async function OrderPage({ params }) {
  await requireUser();
  const { key } = await params;
  let order;
  try {
    const o = await getOrderByName(key);
    if (!o) notFound();
    [order] = await enrichOrders([o]);
  } catch (e) {
    if (e?.digest?.startsWith?.("NEXT_")) throw e;
    return <Notice tone="bad">Couldn&apos;t load #{key} from Shopify: {e.message}</Notice>;
  }

  const a = order.address || {};
  const itemsTotal = order.items.reduce((s, i) => s + i.price * i.qty, 0);
  const costed = order.items.filter((i) => i.product?.cost != null);
  const cost = costed.reduce((s, i) => s + withVat(i.product.cost) * i.qty, 0);
  const allCosted = costed.length === order.items.length && order.items.length > 0;

  return (
    <div>
      <PageHeader
        crumbs={[{ label: "Shopify orders", href: "/orders" }, { label: order.name }]}
        title={<span className="flex items-center gap-2"><span className="num">{order.name}</span><PayBadge status={order.financial} /><Badge tone={order.tracking.length ? "ok" : "warn"}>{String(order.fulfillment).replace(/_/g, " ").toLowerCase()}</Badge>{order.cancelled ? <Badge tone="bad">cancelled</Badge> : null}</span>}
        sub={`Placed ${shortDate(order.createdAt)} · ${order.shippingMethod || "no shipping method"}`}
        actions={<OrderActions order={order} />}
      />
      {order.note ? <div className="mb-3"><Notice tone="info"><b>Customer note:</b> {order.note}</Notice></div> : null}

      <div className="grid xl:grid-cols-[1fr_340px] gap-3 items-start">
        <div className="grid gap-3">
          <Panel title="Items" pad={false}>
            <table className="tbl">
              <thead><tr><th className="r">Qty</th><th>P&amp;P code</th><th>Item</th><th>Size</th><th className="r">Price</th><th className="r">Cost incl VAT</th></tr></thead>
              <tbody>
                {order.items.map((i) => (
                  <tr key={i.id}>
                    <td className="r num">{i.qty}</td>
                    <td><ItemCode item={i} /></td>
                    <td>{i.title}{i.variant ? <span className="text-faint"> · {i.variant}</span> : null}{i.sku && i.product && i.sku !== i.product.code ? <div className="text-[11px] text-faint num">Shopify SKU {i.sku}</div> : null}</td>
                    <td className="num text-muted">{i.product?.size || ""}</td>
                    <td className="r num whitespace-nowrap">{zar(i.price * i.qty)}{i.listPrice > i.price ? <div className="text-[11px] text-faint line-through">{zar(i.listPrice * i.qty)}</div> : null}</td>
                    <td className="r num text-muted whitespace-nowrap">{i.product?.cost != null ? zar(withVat(i.product.cost) * i.qty) : "—"}{i.product?.freeIssue ? <div><Badge tone="info">free issue</Badge></div> : null}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr><td colSpan={4} className="text-muted">Items</td><td className="r num whitespace-nowrap">{zar(itemsTotal)}</td><td className="r num whitespace-nowrap">{costed.length ? zar(cost) : "—"}</td></tr>
                <tr><td colSpan={4} className="text-muted">Shipping charged</td><td className="r num whitespace-nowrap">{zar(order.shippingCharged)}</td><td></td></tr>
                <tr><td colSpan={4} className="font-semibold">Order total</td><td className="r num font-semibold whitespace-nowrap">{zar(order.total)}</td>
                  <td className="r text-[12px] whitespace-nowrap">{allCosted ? <>margin <span className="num font-semibold">{zar(itemsTotal - cost)}</span></> : <span className="text-faint">some costs missing</span>}</td></tr>
              </tfoot>
            </table>
          </Panel>

          <Panel title="Shipments" pad={false}>
            {order.tracking.length ? (
              <table className="tbl">
                <thead><tr><th>Tracking</th><th>Carrier</th><th>Status</th><th>Shipped</th><th className="r">Print</th></tr></thead>
                <tbody>{order.tracking.map((t) => <TrackingRow key={t.number} t={t} />)}</tbody>
              </table>
            ) : <p className="p-3 text-muted">Not shipped yet.</p>}
          </Panel>
        </div>

        <div className="grid gap-3">
          <Panel title="Deliver to">
            <div className="grid gap-0.5">
              <div className="font-medium">{a.name || order.customer.name}</div>
              {a.company ? <div>{a.company}</div> : null}
              <div>{a.address1}</div>
              {a.address2 ? <div>{a.address2}</div> : null}
              <div>{[a.city, a.provinceCode || a.province, a.zip].filter(Boolean).join(", ")}</div>
              {!order.address ? <div className="text-bad">No shipping address on this order</div> : null}
            </div>
          </Panel>
          <Panel title="Customer">
            <div className="grid gap-0.5">
              <div className="font-medium">{order.customer.name}</div>
              {order.customer.email ? <a className="hover:text-accent" href={`mailto:${order.customer.email}`}>{order.customer.email}</a> : null}
              {order.customer.phone ? <a className="num hover:text-accent" href={`tel:${order.customer.phone}`}>{order.customer.phone}</a> : null}
            </div>
          </Panel>
          <Panel title="Picking slip / PO"><Pipeline order={order} canCreate={!order.cancelled} /></Panel>
          {order.tags.length ? <Panel title="Tags"><div className="flex flex-wrap gap-1">{order.tags.map((t) => <Badge key={t}>{t}</Badge>)}</div></Panel> : null}
        </div>
      </div>
    </div>
  );
}
