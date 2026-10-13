import "server-only";
import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { shopifyGraphQL } from "@/lib/shopify";
import { TABS } from "@/lib/orders";

// Sidebar badges. Failures just hide the badge.
export async function toShipCount() {
  try {
    const d = await shopifyGraphQL(`query C($q: String!) { orders(first: 100, query: $q) { nodes { id } pageInfo { hasNextPage } } }`, { q: TABS.toship.query });
    return d.orders.pageInfo.hasNextPage ? "100+" : d.orders.nodes.length;
  } catch { return null; }
}

export async function navCounts(isAdmin) {
  const out = { toShip: await toShipCount() };
  if (!isAdmin) return out;
  try {
    const supabase = await createClient();
    const { count } = await supabase.from("unknown_skus").select("id", { count: "exact", head: true }).eq("resolved", false);
    out.unmapped = count || 0;
  } catch {}
  try {
    const { count } = await createAdminClient().from("profiles").select("id", { count: "exact", head: true }).eq("role", "pending");
    out.pendingUsers = count || 0;
  } catch {}
  return out;
}
