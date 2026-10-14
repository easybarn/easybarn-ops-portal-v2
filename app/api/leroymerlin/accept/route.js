import { NextResponse } from "next/server";
import { apiUser, fail } from "@/lib/auth";
import { getLmOrder, lmAccept } from "@/lib/leroymerlin";

// POST { orderId } — accept a pending Leroy Merlin order in Mirakl
export async function POST(request) {
  const { res } = await apiUser();
  if (res) return res;
  try {
    const { orderId } = await request.json();
    const order = await getLmOrder(String(orderId || ""));
    if (!order) return fail(new Error("Leroy Merlin order not found"), 404);
    if (order.state !== "WAITING_ACCEPTANCE") return fail(new Error(`${order.name} is already “${order.status}”`), 409);
    const lines = await lmAccept(order);
    return NextResponse.json({ ok: true, lines });
  } catch (e) { return fail(e); }
}
