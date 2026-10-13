import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { apiUser, fail } from "@/lib/auth";
import { listProducts } from "@/lib/products";

export async function GET() {
  const { res } = await apiUser();
  if (res) return res;
  try {
    const products = await listProducts({ includeArchived: true });
    const rows = products.map((p) => ({
      "NICKNAME": p.nickname || "",
      "WAREHOUSE CODE": p.warehouse_code,
      "WAREHOUSE DOOR DESCRIPTION": p.description || "",
      "SIZE": p.size || "",
      "CATEGORY": p.category || "",
      "SHOPIFY SKU CODE": p.shopify_sku || "",
      "TAKEALOT SKU": p.takealot_sku || "",
      "LEROY MERLIN CODE": p.leroymerlin_sku || "",
      "COST EXCL VAT": p.cost_excl_vat ?? "",
      "COST INCL VAT": p.cost_incl_vat ?? "",
      "FREE ISSUE": p.free_issue ? "YES" : "NO",
      "ACTIVE": p.active ? "YES" : "NO",
      "NOTES": p.notes || "",
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "PRODUCTS");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    return new NextResponse(buf, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="easybarn-products-${new Date().toISOString().slice(0, 10)}.xlsx"`,
      },
    });
  } catch (e) { return fail(e); }
}
