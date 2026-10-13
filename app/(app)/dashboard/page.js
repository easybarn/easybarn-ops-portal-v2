import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { listProducts, listUnknownSkus } from "@/lib/products";
import { createAdminClient } from "@/lib/supabase-admin";
import { PageHeader, Panel, Stat, Badge, MpDot, Empty, Notice } from "@/components/ui";
import { ago } from "@/lib/format";
import { toShipCount } from "@/lib/counts";

export const metadata = { title: "Overview" };

export default async function Overview() {
  const { profile, isAdmin } = await requireUser();
  let products = [], unknown = [], pending = [], loadError = null;
  const toShip = await toShipCount();
  try {
    [products, unknown] = await Promise.all([listProducts(), isAdmin ? listUnknownSkus() : []]);
    if (isAdmin) {
      const { data } = await createAdminClient().from("profiles").select("id, full_name, email, created_at").eq("role", "pending").order("created_at", { ascending: false });
      pending = data || [];
    }
  } catch (e) { loadError = e.message; }

  const missingCost = products.filter((p) => p.cost_excl_vat == null && !p.free_issue).length;
  const noSku = products.filter((p) => !p.shopify_sku && !p.takealot_sku && !p.leroymerlin_sku).length;
  const date = new Date().toLocaleDateString("en-ZA", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Johannesburg" });
  const hour = Number(new Date().toLocaleString("en-ZA", { hour: "numeric", hourCycle: "h23", timeZone: "Africa/Johannesburg" }));
  const greet = hour < 12 ? "Morning" : hour < 17 ? "Afternoon" : "Evening";

  return (
    <div>
      <PageHeader title={`${greet}, ${(profile.full_name || "there").split(" ")[0]}`} sub={date} />
      {loadError ? <div className="mb-4"><Notice tone="bad">Couldn&apos;t load data: {loadError}</Notice></div> : null}

      <div className="grid grid-cols-2 lg:grid-cols-6 gap-2 mb-4">
        <Stat label="Shopify to ship" value={toShip ?? "—"} tone={toShip ? "bad" : "ok"} href="/orders" />
        <Stat label="Active products" value={products.length} href="/products" />
        <Stat label="Missing cost" value={missingCost} tone={missingCost ? "warn" : "ok"} href="/products?f=no_cost" />
        <Stat label="No marketplace SKU" value={noSku} tone={noSku ? "warn" : undefined} href="/products?f=no_sku" />
        {isAdmin ? <Stat label="Unmapped SKUs" value={unknown.length} tone={unknown.length ? "bad" : "ok"} href="/products/unmapped" /> : null}
        {isAdmin ? <Stat label="Pending users" value={pending.length} tone={pending.length ? "warn" : undefined} href="/users" /> : null}
      </div>

      {isAdmin ? (
        <div className="grid lg:grid-cols-2 gap-3">
          <Panel title="Unmapped SKUs" pad={false} actions={<Link href="/products/unmapped" className="text-[12px] text-accent hover:underline">Map all →</Link>}>
            {unknown.length ? (
              <table className="tbl">
                <thead><tr><th>SKU</th><th>Channel</th><th className="r">Seen</th><th className="r">Last</th></tr></thead>
                <tbody>
                  {unknown.slice(0, 8).map((u) => (
                    <tr key={u.id}>
                      <td className="num">{u.sku}</td>
                      <td><span className="inline-flex items-center gap-1.5"><MpDot mp={u.marketplace} />{u.marketplace}</span></td>
                      <td className="r num">{u.occurrence_count}×</td>
                      <td className="r text-muted">{ago(u.last_seen_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <Empty>Every SKU on recent orders is mapped.</Empty>}
          </Panel>
          <Panel title="Waiting for approval" pad={false} actions={<Link href="/users" className="text-[12px] text-accent hover:underline">Manage →</Link>}>
            {pending.length ? (
              <table className="tbl">
                <thead><tr><th>Name</th><th>Email</th><th className="r">Requested</th></tr></thead>
                <tbody>
                  {pending.map((u) => (
                    <tr key={u.id}><td>{u.full_name || "—"}</td><td className="text-muted">{u.email}</td><td className="r text-muted">{ago(u.created_at)}</td></tr>
                  ))}
                </tbody>
              </table>
            ) : <Empty>No one is waiting.</Empty>}
          </Panel>
        </div>
      ) : null}

      <p className="text-[12px] text-faint mt-6">
        Takealot, Leroy Merlin and WhatsApp still run in the old portal <Badge>links in sidebar</Badge>
      </p>
    </div>
  );
}
