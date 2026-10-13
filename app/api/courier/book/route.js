import { NextResponse } from "next/server";
import { apiUser, fail } from "@/lib/auth";
import { getOrderById } from "@/lib/orders";
import { shopifyGraphQL } from "@/lib/shopify";
import { syncWaybillToSlipAndPo } from "@/lib/waybill-sync";
import { COLLECTION_ADDRESS, COLLECTION_CONTACT, deliveryFromShopify, tcgCreateShipment, toParcels, trackingUrl } from "@/lib/courier";

// POST { orderId, parcels, serviceLevelCode, collectionDate, notifyCustomer?, allowRebook? }
// Books The Courier Guy, then fulfils the Shopify order with the tracking number.
export async function POST(request) {
  const { res } = await apiUser();
  if (res) return res;

  let b;
  try { b = await request.json(); } catch { return fail(new Error("Invalid request"), 400); }
  if (!b.serviceLevelCode) return fail(new Error("Choose a service first"), 400);

  let order;
  try { order = await getOrderById(b.orderId); } catch (e) { return fail(e); }
  if (!order) return fail(new Error("Order not found in Shopify"), 404);
  if (!order.address) return fail(new Error("This order has no shipping address"), 400);
  if (order.cancelled) return fail(new Error(`${order.name} is cancelled`), 400);
  // Guard against double bookings
  if (order.tracking.length && !b.allowRebook) {
    return fail(new Error(`${order.name} already has tracking ${order.tracking.map((t) => t.number).join(", ")}. Tick "book another shipment" to send more parcels.`), 409);
  }

  let parcels;
  try { parcels = toParcels(b.parcels); } catch (e) { return fail(e, 400); }

  let shipment;
  try {
    shipment = await tcgCreateShipment({
      collection_address: COLLECTION_ADDRESS,
      collection_contact: COLLECTION_CONTACT,
      delivery_address: deliveryFromShopify(order.address),
      delivery_contact: {
        name: order.customer.name || "Customer",
        email: order.customer.email || "hello@easybarn.co.za",
        mobile_number: order.customer.phone || order.address.phone || "+27000000000",
      },
      parcels,
      service_level_code: b.serviceLevelCode,
      collection_min_date: `${b.collectionDate}T08:00:00Z`,
      customer_reference: order.name,
    });
  } catch (e) { return fail(e, 502); }

  const ref = shipment.short_tracking_reference;
  const result = { success: true, trackingReference: ref, shipmentId: shipment.id, warnings: [] };

  try {
    const sync = await syncWaybillToSlipAndPo({ marketplace: "shopify", orderId: order.key, waybill: ref });
    result.linked = sync.updated;
  } catch {}

  // Fulfil in Shopify
  try {
    const fo = await shopifyGraphQL(
      `query FO($id: ID!) { order(id: $id) { fulfillmentOrders(first: 10) { nodes { id status lineItems(first: 50) { nodes { id remainingQuantity } } } } } }`,
      { id: order.id }
    );
    const open = fo.order.fulfillmentOrders.nodes.filter((f) => f.status === "OPEN" || f.status === "IN_PROGRESS");
    if (!open.length) {
      result.warnings.push("Booked, but Shopify had no open fulfilment for this order. Add the tracking in Shopify by hand.");
    } else {
      const r = await shopifyGraphQL(
        `mutation F($fulfillment: FulfillmentV2Input!) { fulfillmentCreateV2(fulfillment: $fulfillment) { fulfillment { id status } userErrors { field message } } }`,
        {
          fulfillment: {
            lineItemsByFulfillmentOrder: open.map((f) => ({
              fulfillmentOrderId: f.id,
              fulfillmentOrderLineItems: f.lineItems.nodes.filter((l) => l.remainingQuantity > 0).map((l) => ({ id: l.id, quantity: l.remainingQuantity })),
            })),
            trackingInfo: { number: ref, url: trackingUrl(ref), company: "The Courier Guy" },
            notifyCustomer: b.notifyCustomer !== false,
          },
        }
      );
      const errs = r.fulfillmentCreateV2.userErrors;
      if (errs.length) result.warnings.push("Booked, but Shopify fulfilment failed: " + errs.map((e) => e.message).join("; "));
      else result.fulfilled = true;
    }
  } catch (e) {
    result.warnings.push("Booked, but Shopify fulfilment failed: " + e.message);
  }
  return NextResponse.json(result);
}
