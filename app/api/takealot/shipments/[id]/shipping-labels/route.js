import { apiUser, fail } from "@/lib/auth";
import { getShipment, dcOf } from "@/lib/takealot";
import { generateShippingLabelsPdf, getDefaultSellerInfo, getDcAddress } from "@/lib/takealot-pdf";
import { pdfResponse } from "@/lib/takealot-http";

// Shipping labels: 6-up A4, one per box. ?count=N&usedSkip=K
export async function GET(request, { params }) {
  const { res } = await apiUser();
  if (res) return res;
  const sp = new URL(request.url).searchParams;
  const count = Math.max(1, Math.min(60, parseInt(sp.get("count") || "1", 10) || 1));
  const usedSkip = Math.max(0, Math.min(5, parseInt(sp.get("usedSkip") || "0", 10) || 0));
  try {
    const s = await getShipment((await params).id, "");
    const pdf = await generateShippingLabelsPdf({
      shipment: { name: s.reference, po_number: s.purchase_order_number, due_date: { date: s.due_date, timestamp: s.due_date ? new Date(s.due_date).getTime() / 1000 : 0 } },
      seller: getDefaultSellerInfo(), dcAddress: getDcAddress(dcOf(s)), count, usedSkip,
    });
    return pdfResponse(pdf, `shipping_labels_${s.reference || s.shipment_id}`);
  } catch (e) { return fail(e); }
}
