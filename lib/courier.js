import "server-only";

// The Courier Guy (Shiplogic API) client + shared shipping constants.

// Keys made in The Courier Guy portal only work on its own API host
const API_BASE = process.env.TCG_API_BASE || "https://api.portal.thecourierguy.co.za";

export const COLLECTION_ADDRESS = {
  type: "business",
  company: "Panel & Pane Joinery",
  street_address: "15 JB McIntosh Drive",
  local_area: "Shongweni",
  city: "Durban",
  code: "3680",
  zone: "KZN",
  country: "South Africa",
  lat: 0,
  lng: 0,
};

export const COLLECTION_CONTACT = {
  name: "Steven Gordon",
  email: "hello@easybarn.co.za",
  mobile_number: "+27828856439",
};

export const trackingUrl = (ref) => "https://www.thecourierguy.co.za/track/?tracking_reference=" + encodeURIComponent(ref);

async function tcg(path, options = {}) {
  if (!process.env.TCG_API_KEY) throw new Error("TCG_API_KEY is missing from .env.local");
  const res = await fetch(API_BASE + path, {
    ...options,
    headers: { Authorization: `Bearer ${process.env.TCG_API_KEY}`, "Content-Type": "application/json", ...(options.headers || {}) },
    cache: "no-store",
  });
  if (!res.ok) {
    const t = await res.text();
    let msg = t;
    try { const j = JSON.parse(t); msg = j.message || j.error || t; } catch {}
    throw new Error(`Courier Guy ${res.status}: ${String(msg).slice(0, 300)}`);
  }
  return res.json();
}

export const tcgGetRates = (payload) => tcg("/rates", { method: "POST", body: JSON.stringify(payload) });
export const tcgCreateShipment = (payload) => tcg("/shipments", { method: "POST", body: JSON.stringify(payload) });
export const tcgGetShipment = (ref) => tcg(`/shipments?tracking_reference=${encodeURIComponent(ref)}`);
export const tcgGetLabel = (ref) => tcg(`/shipments/label?tracking_reference=${encodeURIComponent(ref)}`);

// Shiplogic returns 20 shipments from start_date, oldest first, and ignores paging,
// so walk forward in time using the newest time_created seen.
export async function tcgListShipments(days = 30) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  let start = cutoff.toISOString();
  const seen = new Set();
  const all = [];
  for (let i = 0; i < 30; i++) {
    const data = await tcg(`/shipments?start_date=${encodeURIComponent(start)}`);
    const page = data.shipments || [];
    let added = 0, latest = start;
    for (const s of page) {
      if (!seen.has(s.id)) { seen.add(s.id); all.push(s); added++; }
      if (s.time_created && s.time_created > latest) latest = s.time_created;
    }
    if (!page.length || !added) break;
    const next = new Date(new Date(latest).getTime() + 1).toISOString();
    if (next === start) break;
    start = next;
  }
  return all
    .map((s) => ({
      id: s.id,
      ref: s.short_tracking_reference,
      customerRef: s.customer_reference || "",
      status: s.status,
      createdAt: s.time_created,
      collectionDate: s.collection_min_date,
      deliveryFrom: s.estimated_delivery_from,
      from: s.collection_branch_name,
      to: s.delivery_branch_name,
      contact: s.delivery_contact?.name || "",
      city: s.delivery_address?.city || "",
      zone: s.delivery_address?.zone || "",
      parcels: (s.parcels || []).length,
      service: s.service_level_code,
      rate: s.charged_amount || s.rate || 0,
    }))
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
}

export function toParcels(parcels) {
  if (!Array.isArray(parcels) || !parcels.length) throw new Error("Add at least one parcel");
  return parcels.map((p, i) => {
    const out = {
      submitted_length_cm: Number(p.length),
      submitted_width_cm: Number(p.width),
      submitted_height_cm: Number(p.height),
      submitted_weight_kg: Number(p.weight),
      parcel_description: p.description || "Retail",
    };
    if (Object.values(out).slice(0, 4).some((v) => !(v > 0))) throw new Error(`Parcel ${i + 1} needs length, width, height and weight`);
    return out;
  });
}

export function deliveryFromShopify(ship) {
  return {
    type: ship.company ? "business" : "residential",
    company: ship.company || undefined,
    street_address: [ship.address1, ship.address2].filter(Boolean).join(", "),
    local_area: ship.city || "",
    city: ship.city || "",
    code: ship.zip || "",
    zone: ship.provinceCode || ship.province || "",
    country: ship.country || "South Africa",
    lat: ship.latitude || 0,
    lng: ship.longitude || 0,
  };
}
