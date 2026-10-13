import { PDFDocument } from "pdf-lib";
import { apiUser, fail } from "@/lib/auth";
import { tcgGetLabel } from "@/lib/courier";

// GET ?refs=A,B,C → one merged PDF of all waybills
export async function GET(request) {
  const { res } = await apiUser();
  if (res) return res;
  const refs = (new URL(request.url).searchParams.get("refs") || "").split(",").map((s) => s.trim()).filter(Boolean);
  if (!refs.length) return fail(new Error("No tracking references"), 400);
  try {
    const merged = await PDFDocument.create();
    const missing = [];
    for (const ref of refs) {
      try {
        const { url } = await tcgGetLabel(ref);
        const bytes = await fetch(url).then((r) => { if (!r.ok) throw new Error(); return r.arrayBuffer(); });
        const src = await PDFDocument.load(bytes);
        (await merged.copyPages(src, src.getPageIndices())).forEach((p) => merged.addPage(p));
      } catch { missing.push(ref); }
    }
    if (!merged.getPageCount()) return fail(new Error("No waybills could be fetched: " + missing.join(", ")), 502);
    return new Response(await merged.save(), {
      headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="waybills-${refs.length}.pdf"`, ...(missing.length ? { "X-Missing-Refs": missing.join(",") } : {}) },
    });
  } catch (e) { return fail(e); }
}
