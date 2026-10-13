import { NextResponse } from "next/server";
import { apiUser, fail } from "@/lib/auth";
import { updatePo } from "@/lib/purchase-orders";

// PATCH { status?, notes?, lines? } — admins only
export async function PATCH(request, { params }) {
  const { res } = await apiUser({ admin: true });
  if (res) return res;
  const { id } = await params;
  try {
    const po = await updatePo(id, await request.json());
    return NextResponse.json({ po });
  } catch (e) { return fail(e, 400); }
}
