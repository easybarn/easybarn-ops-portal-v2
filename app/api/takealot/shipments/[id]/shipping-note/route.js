import { apiUser, fail } from "@/lib/auth";
import { loadShipment, pdfShipment } from "@/lib/takealot";
import { generateShippingNotePdf, getDefaultSellerInfo, getDcAddress } from "@/lib/takealot-pdf";
import { pdfResponse } from "@/lib/takealot-http";

// Shipping note: 1 page A4, goes inside the box
export async function GET(_req, { params }) {
  const { res } = await apiUser();
  if (res) return res;
  try {
    const s = await loadShipment((await params).id);
    // One row per offer
    const rows = new Map();
    for (const i of s.items) {
      const r = rows.get(i.offerId) || { barcode: i.barcode, title: i.title, tsin: i.tsin, sku: i.sku, units: 0 };
      r.units += i.sending;
      rows.set(i.offerId, r);
    }
    const pdf = await generateShippingNotePdf({ shipment: pdfShipment(s), seller: getDefaultSellerInfo(), items: [...rows.values()], dcAddress: getDcAddress(s.dc) });
    return pdfResponse(pdf, `shipping_note_${s.reference || s.id}`);
  } catch (e) { return fail(e); }
}
