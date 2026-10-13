import { NextResponse } from "next/server";
import { apiUser, fail } from "@/lib/auth";
import { mapSku } from "@/lib/products";

// Body: { marketplace, sku, note? }
export async function POST(request, { params }) {
  const { ctx, res } = await apiUser({ admin: true });
  if (res) return res;
  const { code } = await params;
  try {
    const b = await request.json();
    return NextResponse.json(await mapSku(decodeURIComponent(code), b.marketplace, b.sku, ctx.user.id, b.note));
  } catch (e) { return fail(e, 400); }
}
