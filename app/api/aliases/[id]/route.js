import { NextResponse } from "next/server";
import { apiUser, fail } from "@/lib/auth";
import { deleteAlias } from "@/lib/products";

export async function DELETE(request, { params }) {
  const { res } = await apiUser({ admin: true });
  if (res) return res;
  const { id } = await params;
  try { await deleteAlias(id); return NextResponse.json({ ok: true }); }
  catch (e) { return fail(e); }
}
