import "server-only";
import { listOrders, enrichOrders } from "@/lib/orders";

const isHardware = (code = "") => /^(HARD|BB|BL)/i.test(code);
// Made-to-measure lines: no SKU, or a custom / purpose-made product
export const isPurposeMade = (i) => !i.sku || /custom|purpose\s*made/i.test(`${i.title} ${i.variant}`);

// All orders on the given tabs (up to ~300), split into stock lines rolled up by
// P&P code, purpose-made lines grouped by order, and unmapped SKUs.
export async function pickingSummary(tabs = ["toship"]) {
  let orders = [];
  for (const tab of tabs) {
    let after = null;
    for (let page = 0; page < 6; page++) {
      const r = await listOrders(tab, { after });
      orders = orders.concat(r.orders);
      if (!r.next) break;
      after = r.next;
    }
  }
  orders = await enrichOrders(orders);

  const lines = new Map();
  const custom = [];
  const unmapped = [];
  for (const o of orders) {
    const made = [];
    for (const i of o.items) {
      if (i.product) {
        const k = i.product.code;
        const l = lines.get(k) || { code: k, description: i.product.description, size: i.product.size, qty: 0, orders: [] };
        l.qty += i.qty;
        l.orders.push(i.qty > 1 ? `${o.name} ×${i.qty}` : o.name);
        lines.set(k, l);
      } else if (isPurposeMade(i)) {
        made.push(i);
      } else {
        unmapped.push({ order: o.name, qty: i.qty, sku: i.sku, title: i.title, variant: i.variant });
      }
    }
    if (made.length) {
      custom.push({
        name: o.name, createdAt: o.createdAt, customer: o.customer.name, phone: o.customer.phone,
        city: [o.address?.city, o.address?.provinceCode].filter(Boolean).join(", "),
        note: o.note, tags: o.tags.filter((t) => !/^koala/i.test(t)),
        items: made,
        // other lines on the same order, so the purpose-made slip shows what ships with it
        alsoOnOrder: o.items.filter((i) => !made.includes(i)).map((i) => `${i.qty}× ${i.product?.code || i.sku}`),
      });
    }
  }
  const all = [...lines.values()].sort((a, b) => a.code.localeCompare(b.code, "en", { numeric: true }));
  return {
    orders,
    doors: all.filter((l) => !isHardware(l.code)),
    hardware: all.filter((l) => isHardware(l.code)),
    custom,
    unmapped,
  };
}
