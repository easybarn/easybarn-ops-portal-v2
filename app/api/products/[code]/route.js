import { NextResponse } from "next/server";
import { apiUser, fail } from "@/lib/auth";
import { updateProduct } from "@/lib/products";

// PATCH also handles archive/restore via { active: false|true }
export async function PATCH(request, { params }) {
  const { ctx, res } = await apiUser({ admin: true });
  if (res) return res;
  const { code } = await params;
  try {
    const product = await updateProduct(decodeURIComponent(code), await request.json(), ctx.user.id);
    return NextResponse.json({ product });
  } catch (e) { return fail(e, 400); }
}
