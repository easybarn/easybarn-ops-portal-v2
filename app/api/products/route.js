import { NextResponse } from "next/server";
import { apiUser, fail } from "@/lib/auth";
import { createProduct } from "@/lib/products";

export async function POST(request) {
  const { ctx, res } = await apiUser({ admin: true });
  if (res) return res;
  try {
    const product = await createProduct(await request.json(), ctx.user.id);
    return NextResponse.json({ product });
  } catch (e) { return fail(e, 400); }
}
