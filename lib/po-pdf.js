import "server-only";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { BUYER, SUPPLIER, poTotals } from "@/lib/purchase-orders";

// A4 purchase order PDF (pdf-lib, no native deps). Returns Uint8Array.
const W = 595.28, H = 841.89, M = 42;
const INK = rgb(0.09, 0.1, 0.11), MUTED = rgb(0.4, 0.42, 0.45), LINE = rgb(0.82, 0.84, 0.86), SOFT = rgb(0.955, 0.96, 0.965), PINK = rgb(0.85, 0.11, 0.38);

const zar = (n) => "R " + Number(n || 0).toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/ /g, " ");
const date = (d) => (d ? new Date(d).toLocaleDateString("en-ZA", { day: "2-digit", month: "short", year: "numeric", timeZone: "Africa/Johannesburg" }) : "");
// WinAnsi-safe text
const safe = (s) => String(s ?? "").replace(/[–—]/g, "-").replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/×/g, "x").replace(/·/g, "-").replace(/…/g, "...").replace(/[^\x20-\x7E\xA0-\xFF]/g, "");

function wrap(text, font, size, width) {
  const words = safe(text).split(/\s+/);
  const out = [];
  let line = "";
  for (const w of words) {
    const t = line ? line + " " + w : w;
    if (font.widthOfTextAtSize(t, size) <= width) line = t;
    else { if (line) out.push(line); line = w; }
  }
  if (line) out.push(line);
  return out.length ? out : [""];
}

export async function generatePoPdf(po) {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Purchase Order ${po.po_number}`);
  pdf.setAuthor(BUYER.name);
  const reg = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let page = pdf.addPage([W, H]);
  const t = (s, x, y, o = {}) => {
    const f = o.bold ? bold : reg, size = o.size || 9, str = safe(s);
    const dx = o.align === "right" ? -f.widthOfTextAtSize(str, size) : 0;
    page.drawText(str, { x: x + dx, y, size, font: f, color: o.color || INK });
  };
  const hr = (y, c = LINE, th = 0.6) => page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: th, color: c });

  // Header
  page.drawRectangle({ x: 0, y: H - 6, width: W, height: 6, color: PINK });
  t(BUYER.name, M, H - 48, { bold: true, size: 16 });
  t(BUYER.tradingAs, M, H - 63, { color: MUTED });
  t(`${BUYER.email}  -  ${BUYER.web}`, M, H - 75, { color: MUTED, size: 8.5 });
  t("PURCHASE ORDER", W - M, H - 46, { bold: true, size: 15, align: "right", color: PINK });
  t(po.po_number, W - M, H - 63, { bold: true, size: 12, align: "right" });
  t(`Date ${date(po.created_at)}`, W - M, H - 76, { align: "right", color: MUTED, size: 8.5 });
  t(`Status ${String(po.status).toUpperCase()}`, W - M, H - 87, { align: "right", color: MUTED, size: 8.5 });
  hr(H - 100, PINK, 1.4);

  // Parties
  let y = H - 120;
  t("BUYER", M, y, { bold: true, size: 7.5, color: MUTED });
  t("SUPPLIER", W / 2 + 10, y, { bold: true, size: 7.5, color: MUTED });
  y -= 13;
  t(BUYER.name, M, y, { bold: true, size: 10 });
  t(SUPPLIER.name, W / 2 + 10, y, { bold: true, size: 10 });
  y -= 12;
  t(BUYER.tradingAs, M, y);
  t(SUPPLIER.lines[0], W / 2 + 10, y);
  y -= 11;
  t(BUYER.email, M, y);
  t(SUPPLIER.lines[1], W / 2 + 10, y);

  // Reference box
  y -= 22;
  const refs = [
    po.source_order_ref ? ["Customer order", po.source_order_ref] : null,
    po.source_slip?.slip_number ? ["Picking slip", po.source_slip.slip_number] : null,
    po.waybill_refs?.length ? ["Waybills", po.waybill_refs.join(", ")] : null,
  ].filter(Boolean);
  if (refs.length) {
    const h = 10 + refs.length * 12;
    page.drawRectangle({ x: M, y: y - h + 8, width: W - 2 * M, height: h, color: SOFT });
    refs.forEach(([k, v], i) => { t(k, M + 8, y - i * 12, { color: MUTED }); t(v, M + 95, y - i * 12, { bold: true }); });
    y -= h + 10;
  }

  // Lines table
  const cols = { code: M + 4, desc: M + 92, qty: M + 346, unit: M + 420, total: W - M - 4 };
  const descW = cols.qty - 40 - cols.desc;
  const head = () => {
    page.drawRectangle({ x: M, y: y - 6, width: W - 2 * M, height: 18, color: INK });
    t("CODE", cols.code, y, { bold: true, size: 8, color: rgb(1, 1, 1) });
    t("DESCRIPTION", cols.desc, y, { bold: true, size: 8, color: rgb(1, 1, 1) });
    t("QTY", cols.qty, y, { bold: true, size: 8, color: rgb(1, 1, 1), align: "right" });
    t("UNIT EXCL", cols.unit, y, { bold: true, size: 8, color: rgb(1, 1, 1), align: "right" });
    t("LINE EXCL", cols.total, y, { bold: true, size: 8, color: rgb(1, 1, 1), align: "right" });
    y -= 20;
  };
  head();
  po.lines.forEach((l, i) => {
    const desc = wrap(l.description, reg, 9, descW);
    const notes = l.line_notes ? wrap(l.line_notes, reg, 7.5, descW) : [];
    const h = desc.length * 11 + notes.length * 9 + 6;
    if (y - h < 120) { page = pdf.addPage([W, H]); y = H - M - 10; head(); }
    if (i % 2 === 0) page.drawRectangle({ x: M, y: y - h + 9, width: W - 2 * M, height: h, color: SOFT });
    t(l.warehouse_code || "-", cols.code, y, { bold: true });
    desc.forEach((d, k) => t(d, cols.desc, y - k * 11));
    notes.forEach((n, k) => t(n, cols.desc, y - desc.length * 11 - k * 9 + 1, { size: 7.5, color: MUTED }));
    t(String(l.quantity), cols.qty, y, { align: "right" });
    if (l.free_issue) {
      t("-", cols.unit, y, { align: "right", color: MUTED });
      t("FREE ISSUE", cols.total, y, { align: "right", bold: true, color: PINK, size: 8 });
    } else if (l.unit_cost_excl == null) {
      t("TBC", cols.unit, y, { align: "right", color: MUTED });
      t("TBC", cols.total, y, { align: "right", color: MUTED });
    } else {
      t(zar(l.unit_cost_excl), cols.unit, y, { align: "right" });
      t(zar(Number(l.unit_cost_excl) * Number(l.quantity)), cols.total, y, { align: "right", bold: true });
    }
    y -= h;
  });
  hr(y + 6, INK, 0.8);

  // Totals
  const tot = poTotals(po.lines);
  if (y < 170) { page = pdf.addPage([W, H]); y = H - M - 10; }
  y -= 12;
  const lx = W - M - 200;
  t("Subtotal excl VAT", lx, y, { color: MUTED }); t(zar(tot.excl), W - M - 4, y, { align: "right", bold: true }); y -= 14;
  t("VAT 15%", lx, y, { color: MUTED }); t(zar(tot.vat), W - M - 4, y, { align: "right", bold: true }); y -= 8;
  page.drawLine({ start: { x: lx, y }, end: { x: W - M, y }, thickness: 0.8, color: INK }); y -= 14;
  t("TOTAL incl VAT", lx, y, { bold: true, size: 10.5 }); t(zar(tot.incl), W - M - 4, y, { align: "right", bold: true, size: 12, color: PINK });
  y -= 16;
  const foot = [tot.free ? `${tot.free} free-issue line${tot.free > 1 ? "s" : ""} supplied from Easy Barn stock, not charged.` : "", tot.missing ? `${tot.missing} line${tot.missing > 1 ? "s" : ""} priced TBC - not in total.` : ""].filter(Boolean).join("  ");
  if (foot) { t(foot, M, y, { size: 8, color: MUTED }); y -= 14; }

  if (po.notes) {
    y -= 6;
    const nl = wrap(po.notes, reg, 9, W - 2 * M - 16);
    page.drawRectangle({ x: M, y: y - nl.length * 11 - 6, width: W - 2 * M, height: nl.length * 11 + 22, color: SOFT });
    t("NOTES", M + 8, y + 4, { bold: true, size: 7.5, color: MUTED });
    nl.forEach((n, k) => t(n, M + 8, y - 9 - k * 11));
  }

  // Footer on every page
  const pages = pdf.getPages();
  pages.forEach((p, i) => {
    p.drawLine({ start: { x: M, y: 40 }, end: { x: W - M, y: 40 }, thickness: 0.5, color: LINE });
    const s = safe(`${BUYER.name} - ${po.po_number} - page ${i + 1} of ${pages.length}`);
    p.drawText(s, { x: (W - reg.widthOfTextAtSize(s, 7.5)) / 2, y: 28, size: 7.5, font: reg, color: MUTED });
  });
  return pdf.save();
}
