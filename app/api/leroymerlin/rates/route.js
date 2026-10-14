import { NextResponse } from "next/server";
import { apiUser, fail } from "@/lib/auth";
import { getLmOrder } from "@/lib/leroymerlin";
import { COLLECTION_ADDRESS, deliveryFromShopify, tcgGetRates, toParcels } from "@/lib/courier";

// POST { orderId, parcels, collectionDate } — The Courier Guy rates for a Leroy Merlin order
export async function POST(request) {
  const { res } = await apiUser();
  if (res) return res;
  try {
    const b = await request.json();
    const order = await getLmOrder(b.orderId);
    if (!order) return fail(new Error("Leroy Merlin order not found"), 404);
    if (!order.address) return fail(new Error("This order has no delivery address"), 400);
    const data = await tcgGetRates({
      collection_address: COLLECTION_ADDRESS,
      delivery_address: deliveryFromShopify(order.address),
      parcels: toParcels(b.parcels),
      collection_min_date: `${b.collectionDate}T08:00:00Z`,
    });
    const rates = (data.rates || []).map((r) => ({
      code: r.service_level?.code || r.service_level_code,
      name: (r.service_level?.name || "Service").trim(),
      description: r.service_level?.description || "",
      rate: Number(r.rate || 0),
      from: r.service_level?.delivery_date_from || null,
      to: r.service_level?.delivery_date_to || null,
    })).sort((a, b) => a.rate - b.rate);
    return NextResponse.json({ rates });
  } catch (e) { return fail(e, 400); }
}
