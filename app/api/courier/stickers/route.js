import { apiUser, fail } from "@/lib/auth";
import { generateStickersPdfForRefs } from "@/lib/sticker-pdf";

// GET ?refs=A,B&startSlot=1..6 → 6-up A4 sticker sheet
export async function GET(request) {
  const { res } = await apiUser();
  if (res) return res;
  const sp = new URL(request.url).searchParams;
  const refs = (sp.get("refs") || "").split(",").map((s) => s.trim()).filter(Boolean);
  const slot = Math.min(6, Math.max(1, parseInt(sp.get("startSlot") || "1", 10) || 1));
  if (!refs.length) return fail(new Error("No tracking references"), 400);
  try {
    const pdf = await generateStickersPdfForRefs(refs, slot);
    return new Response(pdf, { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="stickers-${refs.join("-")}.pdf"` } });
  } catch (e) { return fail(e, 502); }
}
