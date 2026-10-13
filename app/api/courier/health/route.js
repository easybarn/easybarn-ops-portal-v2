import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { apiUser } from "@/lib/auth";

// Admin-only: shows which TCG key the running server loaded (fingerprint only) and whether Shiplogic accepts it.
const ALLOWED = ["https://api.shiplogic.com", "https://api.portal.thecourierguy.co.za"];

export async function GET(request) {
  const { res } = await apiUser({ admin: true });
  if (res) return res;
  const key = process.env.TCG_API_KEY || "";
  const want = new URL(request.url).searchParams.get("base");
  const base = ALLOWED.includes(want) ? want : process.env.TCG_API_BASE || "https://api.shiplogic.com";
  const out = { base, keyLength: key.length, keyFingerprint: key ? createHash("sha256").update(key.trim()).digest("hex").slice(0, 8) : null };
  try {
    const r = await fetch(`${base}/shipments?start_date=${encodeURIComponent(new Date(Date.now() - 864e5).toISOString())}`, { headers: { Authorization: `Bearer ${key}` }, cache: "no-store" });
    out.status = r.status;
    out.message = r.ok ? "OK" : (await r.text()).slice(0, 200);
  } catch (e) { out.status = 0; out.message = e.message; }
  return NextResponse.json(out);
}
