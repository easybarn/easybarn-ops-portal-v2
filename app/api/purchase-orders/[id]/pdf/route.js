import { apiUser, fail } from "@/lib/auth";
import { getPo } from "@/lib/purchase-orders";
import { generatePoPdf } from "@/lib/po-pdf";

export async function GET(request, { params }) {
  const { res } = await apiUser();
  if (res) return res;
  const { id } = await params;
  try {
    const po = await getPo(id);
    if (!po) return fail(new Error("PO not found"), 404);
    const bytes = await generatePoPdf(po);
    const download = new URL(request.url).searchParams.get("download") === "1";
    return new Response(bytes, { headers: { "Content-Type": "application/pdf", "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${po.po_number}.pdf"` } });
  } catch (e) { return fail(e); }
}
