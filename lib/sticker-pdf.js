import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import bwipjs from "bwip-js";
import "server-only";
import { tcgGetShipment } from "./courier";

// A4 in points: 595.28 x 841.89
// 2 columns x 3 rows = 6 stickers per page
// Each sticker: ~297.64 x 280.63 points (sticker boundaries)
// Use internal padding for visual breathing room

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const COLS = 2;
const ROWS = 3;
const STICKER_W = PAGE_WIDTH / COLS;     // ~297.64
const STICKER_H = PAGE_HEIGHT / ROWS;    // ~280.63
const PAD = 10;

// Generate a Code 128 barcode PNG buffer for the given text
async function makeBarcode(text) {
  return new Promise((resolve, reject) => {
    bwipjs.toBuffer(
      {
        bcid: "code128",
        text: text,
        scale: 2,
        height: 12,
        includetext: false,
        backgroundcolor: "FFFFFF",
      },
      (err, png) => {
        if (err) reject(err);
        else resolve(png);
      }
    );
  });
}

// Format ISO date to "21 May 2026"
function fmtDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// Format ISO date to "2026-05-21"
function fmtDateShort(iso) {
  if (!iso) return "";
  return iso.split("T")[0];
}

// Truncate text to fit a width given font + size
function fit(text, font, size, maxWidth) {
  if (!text) return "";
  let s = text;
  while (s.length > 0 && font.widthOfTextAtSize(s, size) > maxWidth) {
    s = s.slice(0, -1);
  }
  if (s.length < text.length && s.length > 3) {
    s = s.slice(0, -1) + "...";
  }
  return s;
}

// Draw one sticker at position (originX, originY) - origin is BOTTOM-LEFT of the sticker box
async function drawSticker(pdfDoc, page, fonts, originX, originY, sticker) {
  const { regular, bold } = fonts;

  // Sticker drawable bounds (with padding)
  const x0 = originX + PAD;
  const x1 = originX + STICKER_W - PAD;
  const y1 = originY + STICKER_H - PAD;   // top
  const y0 = originY + PAD;               // bottom
  const innerW = x1 - x0;

  // Helper to draw text
  function text(str, x, y, opts = {}) {
    const size = opts.size || 7;
    const font = opts.bold ? bold : regular;
    page.drawText(String(str || ""), {
      x,
      y,
      size,
      font,
      color: opts.color || rgb(0, 0, 0),
    });
  }

  // Helper to draw a horizontal line
  function hline(y) {
    page.drawLine({
      start: { x: x0, y },
      end: { x: x1, y },
      thickness: 0.5,
      color: rgb(0, 0, 0),
    });
  }

  // ===== Top row: Route header (left) + parcel count (right) =====
  let cursorY = y1 - 8;

  // Route header (left aligned)
  const routeText = `${sticker.routeFrom || ""} > ${sticker.routeTo || ""}`;
  text(routeText, x0, cursorY - 8, {
    size: 10,
    bold: true,
  });

  // Parcel count (right aligned)
  const parcelCount = `${sticker.parcelNum}/${sticker.parcelTotal}`;
  const pcWidth = bold.widthOfTextAtSize(parcelCount, 10);
  text(parcelCount, x1 - pcWidth, cursorY - 8, { size: 10, bold: true });

  cursorY -= 20;

  // ===== Barcode =====
  try {
    const barcodeText = sticker.parcelTrackingRef;
    const pngBuffer = await makeBarcode(barcodeText);
    const pngImage = await pdfDoc.embedPng(pngBuffer);
    const barW = innerW;
    const barH = 30;
    page.drawImage(pngImage, {
      x: x0,
      y: cursorY - barH,
      width: barW,
      height: barH,
    });
    cursorY -= barH + 2;
  } catch (e) {
    text("(barcode failed)", x0, cursorY - 10, { size: 6 });
    cursorY -= 14;
  }

  // Tracking ref text under barcode (centered, bold)
  const refText = sticker.parcelTrackingRef;
  const refWidth = bold.widthOfTextAtSize(refText, 9);
  text(refText, x0 + innerW / 2 - refWidth / 2, cursorY - 9, { size: 9, bold: true });
  cursorY -= 14;

  // ===== Horizontal separator =====
  hline(cursorY);
  cursorY -= 8;

  // ===== From / Date + Col. agent / Del. agent block =====
  const labelSize = 6;
  const valueSize = 7;
  const lineH = 9;
  const labelColW = 40;
  const col1ValX = x0 + labelColW;
  const col2LabelX = x0 + innerW / 2;
  const col2ValX = col2LabelX + labelColW;

  text("From", x0, cursorY, { size: labelSize, bold: true });
  text("-", col1ValX, cursorY, { size: valueSize });
  text("Col. agent", col2LabelX, cursorY, { size: labelSize, bold: true });
  text(sticker.collectionAgent || "", col2ValX, cursorY, { size: valueSize });
  cursorY -= lineH;

  text("Date", x0, cursorY, { size: labelSize, bold: true });
  text(fmtDateShort(sticker.dateCreated), col1ValX, cursorY, { size: valueSize });
  text("Del. agent", col2LabelX, cursorY, { size: labelSize, bold: true });
  text(sticker.deliveryAgent || "", col2ValX, cursorY, { size: valueSize });
  cursorY -= lineH + 2;

  hline(cursorY);
  cursorY -= 8;

  // ===== Account / Routing code / Service level =====
  const col3W = innerW / 3;
  text("Account", x0, cursorY, { size: labelSize, bold: true });
  text("Routing code", x0 + col3W, cursorY, { size: labelSize, bold: true });
  text("Service level", x0 + col3W * 2, cursorY, { size: labelSize, bold: true });
  cursorY -= 8;
  text(sticker.account || "", x0, cursorY, { size: 9, bold: true });
  text(sticker.routingCode || "", x0 + col3W, cursorY, { size: 9, bold: true });
  text(sticker.serviceLevel || "", x0 + col3W * 2, cursorY, { size: 9, bold: true });
  cursorY -= lineH + 2;

  hline(cursorY);
  cursorY -= 8;

  // ===== Reference / Customer ref / Earliest delivery =====
  text("Reference", x0, cursorY, { size: labelSize, bold: true });
  text(sticker.reference || "", col1ValX, cursorY, { size: valueSize });
  cursorY -= lineH;

  text("Customer ref.", x0, cursorY, { size: labelSize, bold: true });
  text(fit(sticker.customerRef || "", regular, valueSize, innerW - labelColW), col1ValX, cursorY, {
    size: valueSize,
  });
  cursorY -= lineH;

  text("Earliest delivery", x0, cursorY, { size: labelSize, bold: true });
  text(fmtDate(sticker.earliestDelivery), col1ValX, cursorY, { size: valueSize });
  cursorY -= lineH + 2;

  // ===== To / Address / Contact / Parcel =====
  text("To", x0, cursorY, { size: labelSize, bold: true });
  text(fit(sticker.toName || "", regular, valueSize, innerW - labelColW), col1ValX, cursorY, {
    size: valueSize,
  });
  cursorY -= lineH;

  text("Address", x0, cursorY, { size: labelSize, bold: true });
  text(fit(sticker.toAddress || "", regular, valueSize, innerW - labelColW), col1ValX, cursorY, {
    size: valueSize,
  });
  cursorY -= lineH;

  // Second line of address if needed
  if (sticker.toAddress2) {
    text(fit(sticker.toAddress2, regular, valueSize, innerW - labelColW), col1ValX, cursorY, {
      size: valueSize,
    });
    cursorY -= lineH;
  }

  text("Contact", x0, cursorY, { size: labelSize, bold: true });
  text(
    fit(`${sticker.contactName || ""} (${sticker.contactPhone || ""})`, regular, valueSize, innerW - labelColW),
    col1ValX,
    cursorY,
    { size: valueSize }
  );
  cursorY -= lineH;

  text("Parcel", x0, cursorY, { size: labelSize, bold: true });
  text(sticker.parcelDescription, col1ValX, cursorY, { size: valueSize });
}

// ===== Main: generate stickers PDF =====
// stickers: array of sticker data objects
// startSlot: 1-based slot index to start at on the first page (1..6)
export async function generateStickersPdf(stickers, startSlot = 1) {
  const pdfDoc = await PDFDocument.create();
  const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fonts = { regular, bold };

  // Slot ordering: top-left = 1, top-right = 2, mid-left = 3, mid-right = 4, bottom-left = 5, bottom-right = 6
  function slotToCoords(slotNum) {
    const idx = slotNum - 1; // 0..5
    const row = Math.floor(idx / 2); // 0,1,2 (top to bottom)
    const col = idx % 2;             // 0,1 (left, right)
    const x = col * STICKER_W;
    const y = PAGE_HEIGHT - (row + 1) * STICKER_H; // bottom-left origin of the sticker box
    return { x, y };
  }

  let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let currentSlot = startSlot;

  for (const sticker of stickers) {
    if (currentSlot > 6) {
      page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      currentSlot = 1;
    }
    const { x, y } = slotToCoords(currentSlot);
    await drawSticker(pdfDoc, page, fonts, x, y, sticker);
    currentSlot++;
  }

  return await pdfDoc.save();
}

// ===== Build sticker data from a Shiplogic shipment object =====
export function buildStickersFromShipment(shipment) {
  const stickers = [];
  const parcels = shipment.parcels || [];
  const total = parcels.length;

  for (let i = 0; i < parcels.length; i++) {
    const p = parcels[i];
    stickers.push({
      parcelNum: i + 1,
      parcelTotal: total,
      parcelTrackingRef: p.tracking_reference,
      parcelDescription: `${p.packaging || "Custom parcel"}: ${p.submitted_length_cm}x${p.submitted_width_cm}x${p.submitted_height_cm}cm, ${p.submitted_weight_kg}kg`,

      routeFrom: shipment.collection_branch_name || "",
      routeTo: shipment.delivery_branch_name || "",

      dateCreated: shipment.time_created,
      collectionAgent: shipment.collection_agent_id || "",
      deliveryAgent: shipment.delivery_agent_id || "",

      account: shipment.account?.account_code || "",
      routingCode: shipment.delivery_agent_routing_number || "",
      serviceLevel: shipment.service_level_code || "",

      reference: shipment.short_tracking_reference,
      customerRef: shipment.customer_reference,
      earliestDelivery: shipment.estimated_delivery_from,

      toName: shipment.delivery_contact?.name || "",
      toAddress: shipment.delivery_address?.street_address || "",
      toAddress2: [
        shipment.delivery_address?.local_area,
        shipment.delivery_address?.city,
        shipment.delivery_address?.code,
        shipment.delivery_address?.zone,
      ]
        .filter(Boolean)
        .join(", "),
      contactName: shipment.delivery_contact?.name || "",
      contactPhone: shipment.delivery_contact?.mobile_number || "",
    });
  }

  return stickers;
}

// ===== Convenience: fetch shipments by tracking refs and produce a stickers PDF =====
export async function generateStickersPdfForRefs(refs, startSlot = 1) {
  const allStickers = [];

  for (const ref of refs) {
    const data = await tcgGetShipment(ref);
    const shipments = data.shipments || [];
    if (shipments.length === 0) continue;
    const stickers = buildStickersFromShipment(shipments[0]);
    allStickers.push(...stickers);
  }

  return generateStickersPdf(allStickers, startSlot);
}
