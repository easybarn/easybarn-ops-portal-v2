import { apiUser, fail } from "@/lib/auth";
import { loadShipment } from "@/lib/takealot";
import { generateProductLabelsPdf } from "@/lib/takealot-pdf";
import { pdfResponse } from "@/lib/takealot-http";

// Product labels: 45-up A4, one per unit. ?usedSkip=K
export async function GET(request, { params }) {
  const { res } = await apiUser();
  if (res) return res;
  const usedSkip = Math.max(0, Math.min(44, parseInt(new URL(request.url).searchParams.get("usedSkip") || "0", 10) || 0));
  try {
    const s = await loadShipment((await params).id);
    const items = s.items.flatMap((i) => Array.from({ length: i.sending }, () => ({ barcode: i.barcode, title: i.title })));
    const pdf = await generateProductLabelsPdf({ items, usedSkip });
    return pdfResponse(pdf, `product_labels_${s.reference || s.id}`);
  } catch (e) { return fail(e); }
}
