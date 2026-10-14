import { NextResponse } from "next/server";
import { apiUser, fail } from "@/lib/auth";
import { createClient } from "@/lib/supabase-server";

// POST { ids: [po id, ...] } — cancel draft POs (not yet emailed). The orders go back to "1 · New".
export async function POST(request) {
  const { res } = await apiUser({ admin: true });
  if (res) return res;
  let ids;
  try { ids = [...new Set((await request.json()).ids || [])].slice(0, 100); } catch { return fail(new Error("Invalid request"), 400); }
  if (!ids.length) return fail(new Error("No POs selected"), 400);
  const supabase = await createClient();
  const { data: pos, error } = await supabase.from("purchase_orders").select("id, po_number, status").in("id", ids);
  if (error) return fail(error);
  const drafts = (pos || []).filter((p) => p.status === "draft");
  const skipped = (pos || []).filter((p) => p.status !== "draft").map((p) => `${p.po_number} (${p.status})`);
  if (drafts.length) {
    const { error: upErr } = await supabase.from("purchase_orders").update({ status: "cancelled", cancelled_at: new Date().toISOString() }).in("id", drafts.map((p) => p.id));
    if (upErr) return fail(upErr);
  }
  return NextResponse.json({ cancelled: drafts.map((p) => p.po_number), skipped });
}
