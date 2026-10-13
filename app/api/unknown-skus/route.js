import { NextResponse } from "next/server";
import { apiUser, fail } from "@/lib/auth";
import { dismissUnknownSku } from "@/lib/products";

// Body: { id, action: "dismiss" }   (mapping goes through /api/products/[code]/map)
export async function POST(request) {
  const { res } = await apiUser({ admin: true });
  if (res) return res;
  try {
    const b = await request.json();
    if (b.action !== "dismiss" || !b.id) return fail(new Error("Unsupported action"), 400);
    await dismissUnknownSku(b.id);
    return NextResponse.json({ ok: true });
  } catch (e) { return fail(e); }
}
