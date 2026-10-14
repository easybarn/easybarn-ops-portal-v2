import { NextResponse } from "next/server";
import { apiUser, fail } from "@/lib/auth";
import { getLmOrder, lmSetTracking, lmMarkShipped, CAN_SHIP } from "@/lib/leroymerlin";
import { syncWaybillToSlipAndPo } from "@/lib/waybill-sync";
import { COLLECTION_ADDRESS, COLLECTION_CONTACT, deliveryFromShopify, tcgCreateShipment, toParcels, trackingUrl } from "@/lib/courier";

// POST { orderId, parcels, serviceLevelCode, collectionDate, allowRebook? }
// Books The Courier Guy, pushes the tracking number to Leroy Merlin and marks the order shipped there.
export async function POST(request) {
  const { res } = await apiUser();
  if (res) return res;

  let b;
  try { b = await request.json(); } catch { return fail(new Error("Invalid request"), 400); }
  if (!b.serviceLevelCode) return fail(new Error("Choose a service first"), 400);

  let order;
  try { order = await getLmOrder(b.orderId); } catch (e) { return fail(e); }
  if (!order) return fail(new Error("Leroy Merlin order not found"), 404);
  if (!order.address) return fail(new Error("This order has no delivery address"), 400);
  if (!CAN_SHIP.includes(order.state) && !b.allowRebook) return fail(new Error(`${order.name} is “${order.status}” in Leroy Merlin, so it can't be shipped from here.`), 409);
  if (order.tracking.length && !b.allowRebook) return fail(new Error(`${order.name} already has tracking ${order.tracking.map((t) => t.number).join(", ")}.`), 409);

  let parcels;
  try { parcels = toParcels(b.parcels); } catch (e) { return fail(e, 400); }

  let shipment;
  try {
    shipment = await tcgCreateShipment({
      collection_address: COLLECTION_ADDRESS,
      collection_contact: COLLECTION_CONTACT,
      delivery_address: deliveryFromShopify(order.address),
      delivery_contact: { name: order.customer.name || "Customer", email: order.customer.email || "hello@easybarn.co.za", mobile_number: order.customer.phone || "+27000000000" },
      parcels,
      service_level_code: b.serviceLevelCode,
      collection_min_date: `${b.collectionDate}T08:00:00Z`,
      customer_reference: `LM${order.id}`, // "LM" prefix marks Leroy Merlin courier costs
    });
  } catch (e) { return fail(e, 502); }

  const ref = shipment.short_tracking_reference;
  const result = { success: true, trackingReference: ref, shipmentId: shipment.id, warnings: [] };
  try { result.linked = (await syncWaybillToSlipAndPo({ marketplace: "leroymerlin", orderId: order.id, waybill: ref })).updated; } catch {}

  try {
    await lmSetTracking(order.id, ref, trackingUrl(ref));
    result.trackingPushed = true;
  } catch (e) {
    result.warnings.push(`Booked, but the tracking number didn't reach Leroy Merlin. Add ${ref} in the LM portal by hand. (${e.message})`);
    return NextResponse.json(result);
  }
  try {
    await lmMarkShipped(order.id);
    result.markedShipped = true;
  } catch (e) {
    result.warnings.push(`Booked and tracking added, but marking it shipped failed. Click “Mark as shipped” in the LM portal. (${e.message})`);
  }
  return NextResponse.json(result);
}
