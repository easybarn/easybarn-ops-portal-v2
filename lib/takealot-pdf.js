import "server-only";
// Takealot PDF generators
// Builds 3 documents matching Takealot's seller portal output:
//   1. Shipping Note      (1 page A4 — summary of shipment)
//   2. Shipping Labels    (6-up A4 — one per box, PO barcode)
//   3. Product Labels     (45-up A4 — one per unit, EAN-13 barcode)
//
// All labels use Code 128 / EAN-13 barcodes that mirror Takealot's PDFs.

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import bwipjs from "bwip-js";

// === Constants ===

const A4_WIDTH = 595.28;   // pt
const A4_HEIGHT = 841.89;  // pt

const TAKEALOT_DC_ADDRESSES = {
  JHB: {
    name: "Takealot",
    line1: "JT Ross Park",
    line2: "5 Merlot Close",
    line3: "Plumbago 4, Witfontein, Ext 55",
    line4: "Johannesburg",
    line5: "Gauteng",
    line6: "1619",
  },
  CPT: {
    name: "Takealot",
    line1: "Takealot Cape Town DC",
    line2: "Capricorn Park",
    line3: "Anglo Industria, Prince George Drive",
    line4: "Cape Town",
    line5: "Western Cape",
    line6: "7945",
  },
  DBN: {
    name: "Takealot",
    line1: "Takealot Durban DC",
    line2: "(see Takealot portal for address)",
    line3: "Durban",
    line4: "",
    line5: "KwaZulu-Natal",
    line6: "",
  },
};

// === Barcode helpers ===

async function makeBarcodePng(text, opts = {}) {
  const {
    bcid = "code128",
    scale = 3,
    height = 10,
    includetext = false,
    textsize = 10,
    textxalign = "center",
  } = opts;
  return new Promise((resolve, reject) => {
    bwipjs.toBuffer(
      {
        bcid,
        text,
        scale,
        height,
        includetext,
        textsize,
        textxalign,
        backgroundcolor: "ffffff",
      },
      (err, png) => {
        if (err) reject(err);
        else resolve(png);
      }
    );
  });
}

// === Helpers for getting field codes ===

// Get DC code from shipment data (e.g. "JHB", "CPT", "DBN")
function dcCodeFromWarehouse(warehouseName) {
  if (!warehouseName) return "";
  const w = warehouseName.toUpperCase();
  if (w.includes("JHB") || w.includes("JOHAN")) return "JHB";
  if (w.includes("CPT") || w.includes("CAPE")) return "CPT";
  if (w.includes("DBN") || w.includes("DURBAN")) return "DBN";
  return w;
}

function fmtDueDate(dueDate) {
  if (!dueDate) return "";
  // Takealot's "Due Date: 2026/05/20" format
  if (dueDate.date) {
    const d = new Date(dueDate.timestamp ? dueDate.timestamp * 1000 : dueDate.date);
    if (isNaN(d.getTime())) return dueDate.date;
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
  }
  return String(dueDate);
}

function fmtToday() {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

// =====================================================================
// PDF 1: SHIPPING NOTE — 1 page A4
// =====================================================================

export async function generateShippingNotePdf({ shipment, seller, items, dcAddress }) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT]);
  const helv = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helvBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const margin = 40;
  let y = A4_HEIGHT - margin;

  const black = rgb(0, 0, 0);
  const grayBg = rgb(0.7, 0.7, 0.7);
  const lightGrayBg = rgb(0.92, 0.92, 0.92);

  // Header: Today's date (left), Created by ... (right)
  page.drawText(fmtToday(), { x: margin, y, size: 9, font: helv, color: black });
  const headerRight = `Created by ${seller.company} for Takealot`;
  const headerRightWidth = helv.widthOfTextAtSize(headerRight, 9);
  page.drawText(headerRight, { x: A4_WIDTH - margin - headerRightWidth, y, size: 9, font: helv, color: black });
  y -= 12;
  const shipNameRight = `Shipment Name: ${shipment.name}`;
  const shipNameRightWidth = helv.widthOfTextAtSize(shipNameRight, 9);
  page.drawText(shipNameRight, { x: A4_WIDTH - margin - shipNameRightWidth, y, size: 9, font: helv, color: black });
  y -= 30;

  // Title: "Shipping Note"
  page.drawText("Shipping Note", { x: margin, y, size: 22, font: helvBold, color: black });
  y -= 30;

  // Gray instruction bar
  const barH = 28;
  page.drawRectangle({ x: margin, y: y - barH, width: A4_WIDTH - 2 * margin, height: barH, color: grayBg });
  const instruction = "Place on top of items inside the box before sealing it. Clearly mark the box with the Shipping Note in on the outside.";
  // Center the text inside the gray bar (multi-line if needed)
  const instrSize = 9;
  const instrWidth = helv.widthOfTextAtSize(instruction, instrSize);
  page.drawText(instruction, {
    x: margin + (A4_WIDTH - 2 * margin - instrWidth) / 2,
    y: y - barH + (barH - instrSize) / 2 + 1,
    size: instrSize,
    font: helvBold,
    color: rgb(1, 1, 1),
  });
  y -= barH + 12;

  // Takealot logo placeholder (text only — we don't have the actual logo)
  const logoY = y;
  page.drawText("takealot", { x: margin + 10, y: logoY - 18, size: 26, font: helvBold, color: rgb(0.2, 0.2, 0.2) });
  page.drawText(".com", { x: margin + 10 + helvBold.widthOfTextAtSize("takealot", 26), y: logoY - 18, size: 18, font: helvBold, color: rgb(0.0, 0.45, 0.9) });
  page.drawText("shop anything you can imagine", { x: margin + 10, y: logoY - 30, size: 7, font: helv, color: rgb(0.4, 0.4, 0.4) });

  // Due Date (top right of logo area)
  const dueText = `Due Date: ${fmtDueDate(shipment.due_date)}`;
  const dueWidth = helvBold.widthOfTextAtSize(dueText, 10);
  page.drawText(dueText, { x: A4_WIDTH - margin - dueWidth - 10, y: logoY - 14, size: 10, font: helvBold, color: black });

  y = logoY - 50;

  // Ship FROM / Ship TO two-column block
  const colWidth = (A4_WIDTH - 2 * margin) / 2;
  const blockHeight = 110;
  // Outline
  page.drawRectangle({ x: margin, y: y - blockHeight, width: A4_WIDTH - 2 * margin, height: blockHeight, borderColor: black, borderWidth: 0.5 });
  // Vertical divider
  page.drawLine({ start: { x: margin + colWidth, y }, end: { x: margin + colWidth, y: y - blockHeight }, color: black, thickness: 0.5 });

  // SHIP FROM column
  const padX = 8;
  let fromY = y - 14;
  page.drawText("SHIP FROM:", { x: margin + padX, y: fromY, size: 9, font: helvBold, color: black });
  fromY -= 14;
  page.drawText(`Seller ID: ${seller.sellerId}`, { x: margin + padX, y: fromY, size: 9, font: helvBold, color: black });
  fromY -= 14;
  page.drawText(seller.company.toUpperCase(), { x: margin + padX, y: fromY, size: 9, font: helvBold, color: black });
  fromY -= 12;
  for (const line of seller.addressLines || []) {
    if (line) {
      page.drawText(line, { x: margin + padX, y: fromY, size: 9, font: helv, color: black });
      fromY -= 12;
    }
  }

  // SHIP TO column
  let toY = y - 14;
  page.drawText("SHIP TO:", { x: margin + colWidth + padX, y: toY, size: 9, font: helvBold, color: black });
  toY -= 14;
  page.drawText(dcAddress.name, { x: margin + colWidth + padX, y: toY, size: 9, font: helvBold, color: black });
  toY -= 12;
  for (const line of [dcAddress.line1, dcAddress.line2, dcAddress.line3, dcAddress.line4, dcAddress.line5, dcAddress.line6]) {
    if (line) {
      page.drawText(line, { x: margin + colWidth + padX, y: toY, size: 9, font: helv, color: black });
      toY -= 12;
    }
  }

  y -= blockHeight + 8;

  // PO Number section
  const poBlockH = 90;
  page.drawRectangle({ x: margin, y: y - poBlockH, width: A4_WIDTH - 2 * margin, height: poBlockH, borderColor: black, borderWidth: 0.5 });
  // "PO Number: XXXXX" centered
  const poText = `PO Number: ${shipment.po_number}`;
  const poWidth = helvBold.widthOfTextAtSize(poText, 12);
  page.drawText(poText, { x: margin + (A4_WIDTH - 2 * margin - poWidth) / 2, y: y - 18, size: 12, font: helvBold, color: black });

  // PO Number barcode (Code 128)
  try {
    const poBarcodePng = await makeBarcodePng(String(shipment.po_number), { bcid: "code128", scale: 5, height: 20 });
    const poBarcodeImg = await pdfDoc.embedPng(poBarcodePng);
    const bcW = 320;
    const bcH = 50;
    page.drawImage(poBarcodeImg, {
      x: margin + (A4_WIDTH - 2 * margin - bcW) / 2,
      y: y - 18 - bcH - 4,
      width: bcW,
      height: bcH,
    });
  } catch (e) {
    page.drawText(`[Barcode: ${shipment.po_number}]`, { x: margin + 20, y: y - 50, size: 10, font: helv, color: black });
  }

  // Shipment Name centered below barcode
  const shipNameText = `Shipment Name: ${shipment.name}`;
  const shipNameWidth = helv.widthOfTextAtSize(shipNameText, 9);
  page.drawText(shipNameText, { x: margin + (A4_WIDTH - 2 * margin - shipNameWidth) / 2, y: y - poBlockH + 8, size: 9, font: helv, color: black });

  y -= poBlockH + 4;

  // Total Boxes row
  const tbH = 22;
  page.drawRectangle({ x: margin, y: y - tbH, width: A4_WIDTH - 2 * margin, height: tbH, borderColor: black, borderWidth: 0.5 });
  const tbText = "Total Boxes:";
  const tbWidth = helvBold.widthOfTextAtSize(tbText, 11);
  // Center "Total Boxes:" with empty box to right
  page.drawText(tbText, { x: margin + (A4_WIDTH - 2 * margin) / 2 - tbWidth, y: y - tbH + 7, size: 11, font: helvBold, color: black });
  // Empty box for total
  page.drawRectangle({ x: margin + (A4_WIDTH - 2 * margin) / 2 + 8, y: y - tbH + 4, width: 40, height: 14, borderColor: black, borderWidth: 0.5 });

  y -= tbH + 4;

  // Shipment Content table
  const tableTop = y;
  // Table header bar
  const headerH = 18;
  page.drawRectangle({ x: margin, y: y - headerH, width: A4_WIDTH - 2 * margin, height: headerH, color: lightGrayBg });
  page.drawText("SHIPMENT CONTENT", { x: margin + padX, y: y - 13, size: 9, font: helvBold, color: black });
  y -= headerH;

  // Column headers
  const colHeaderH = 16;
  const cols = [
    { label: "MP Takealot Barcode", x: margin + padX, w: 130 },
    { label: "Product Title", x: margin + 130 + padX, w: 200 },
    { label: "TSIN", x: margin + 330 + padX, w: 70 },
    { label: "SKU", x: margin + 400 + padX, w: 70 },
    { label: "Units", x: margin + 470 + padX, w: 40 },
  ];
  page.drawRectangle({ x: margin, y: y - colHeaderH, width: A4_WIDTH - 2 * margin, height: colHeaderH, borderColor: black, borderWidth: 0.5 });
  for (const c of cols) {
    page.drawText(c.label, { x: c.x, y: y - 11, size: 8, font: helvBold, color: black });
  }
  y -= colHeaderH;

  // Item rows
  for (const item of items) {
    const rowH = 28;
    page.drawRectangle({ x: margin, y: y - rowH, width: A4_WIDTH - 2 * margin, height: rowH, borderColor: black, borderWidth: 0.5 });
    page.drawText(String(item.barcode || ""), { x: cols[0].x, y: y - 14, size: 8, font: helv, color: black });
    // Product title — wrap to 2 lines if long
    const title = item.title || "";
    const maxTitleWidth = cols[1].w - 6;
    let titleLines = [];
    const words = title.split(" ");
    let current = "";
    for (const w of words) {
      const test = current + (current ? " " : "") + w;
      if (helv.widthOfTextAtSize(test, 8) > maxTitleWidth) {
        if (current) titleLines.push(current);
        current = w;
      } else {
        current = test;
      }
    }
    if (current) titleLines.push(current);
    titleLines = titleLines.slice(0, 3);
    let titleY = y - 10;
    for (const line of titleLines) {
      page.drawText(line, { x: cols[1].x, y: titleY, size: 8, font: helv, color: black });
      titleY -= 9;
    }
    page.drawText(String(item.tsin || ""), { x: cols[2].x, y: y - 14, size: 8, font: helv, color: black });
    page.drawText(String(item.sku || ""), { x: cols[3].x, y: y - 14, size: 8, font: helv, color: black });
    page.drawText(String(item.units || ""), { x: cols[4].x, y: y - 14, size: 8, font: helv, color: black });
    y -= rowH;
  }

  // Page footer
  const footerText = "Page 1 of 1";
  const footerWidth = helv.widthOfTextAtSize(footerText, 9);
  page.drawText(footerText, { x: (A4_WIDTH - footerWidth) / 2, y: 20, size: 9, font: helv, color: black });

  return Buffer.from(await pdfDoc.save());
}

// =====================================================================
// PDF 2: SHIPPING LABELS — 6-up A4 (2 cols × 3 rows portrait)
// =====================================================================

export async function generateShippingLabelsPdf({ shipment, seller, dcAddress, count = 1, usedSkip = 0 }) {
  const pdfDoc = await PDFDocument.create();
  const helv = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helvBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const black = rgb(0, 0, 0);
  const lightGray = rgb(0.85, 0.85, 0.85);

  // 6-up grid on A4 portrait — 2 cols × 3 rows
  // We use the same dimensions as TCG 6-up to match common label sheets
  // Each label is roughly 105mm × 99mm (Avery J8165 / L7165)
  const cellW = A4_WIDTH / 2;
  const cellH = A4_HEIGHT / 3;
  const padX = 16;
  const padY = 16;

  // Pre-generate the PO barcode once
  let poBarcodeImg = null;
  try {
    const poBarcodePng = await makeBarcodePng(String(shipment.po_number), { bcid: "code128", scale: 4, height: 18 });
    poBarcodeImg = await pdfDoc.embedPng(poBarcodePng);
  } catch (e) {
    // Fall back to text below
  }

  // Determine number of pages needed (accounting for skipped cells on first page)
  const labelsPerPage = 6;
  const skip = Math.max(0, Math.min(labelsPerPage - 1, usedSkip || 0));
  const totalPages = Math.ceil((count + skip) / labelsPerPage);
  let labelsDrawn = 0;

  for (let pageNum = 0; pageNum < totalPages; pageNum++) {
    const page = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT]);
    // On page 1, skip the first N cells (labels already used)
    const startCell = pageNum === 0 ? skip : 0;

    for (let cell = startCell; cell < labelsPerPage; cell++) {
      if (labelsDrawn >= count) break;
      labelsDrawn++;

      const col = cell % 2;
      const row = Math.floor(cell / 2);
      // Origin (bottom-left) of this label
      const ox = col * cellW;
      const oy = A4_HEIGHT - (row + 1) * cellH;

      // Inner drawing area
      const ix = ox + padX;
      const iy = oy + padY;
      const iw = cellW - 2 * padX;
      const ih = cellH - 2 * padY;

      let cursorY = iy + ih;  // top

      // "PLEASE LEAVE THIS LABEL UNCOVERED"
      const leaveText = "PLEASE LEAVE THIS LABEL UNCOVERED";
      const leaveSize = 7;
      const leaveWidth = helv.widthOfTextAtSize(leaveText, leaveSize);
      page.drawText(leaveText, {
        x: ix + (iw - leaveWidth) / 2,
        y: cursorY - leaveSize,
        size: leaveSize,
        font: helv,
        color: rgb(0.5, 0.5, 0.5),
      });
      cursorY -= 14;

      // "Marketplace Shipment" (left) and "Due Date: XXX" (right)
      page.drawText("Marketplace Shipment", {
        x: ix, y: cursorY - 12, size: 12, font: helvBold, color: black,
      });
      const dueText = `Due Date: ${fmtDueDate(shipment.due_date)}`;
      const dueWidth = helvBold.widthOfTextAtSize(dueText, 10);
      page.drawText(dueText, {
        x: ix + iw - dueWidth, y: cursorY - 11, size: 10, font: helvBold, color: black,
      });
      cursorY -= 18;

      // Horizontal divider
      page.drawLine({ start: { x: ix, y: cursorY }, end: { x: ix + iw, y: cursorY }, color: black, thickness: 1 });
      cursorY -= 8;

      // Two-column FROM / TO block
      const colsTop = cursorY;
      const halfW = iw / 2;

      // FROM column
      let fromY = colsTop;
      page.drawText("SHIP FROM:", { x: ix, y: fromY - 9, size: 8, font: helvBold, color: black });
      fromY -= 11;
      page.drawText(`Seller ID: ${seller.sellerId}`, { x: ix, y: fromY - 9, size: 8, font: helvBold, color: black });
      fromY -= 11;
      page.drawText(seller.company.toUpperCase(), { x: ix, y: fromY - 9, size: 7.5, font: helvBold, color: black });
      fromY -= 10;
      for (const line of seller.addressLines || []) {
        if (line) {
          page.drawText(line, { x: ix, y: fromY - 8, size: 7, font: helv, color: black });
          fromY -= 9;
        }
      }

      // TO column
      let toY = colsTop;
      page.drawText("SHIP TO:", { x: ix + halfW, y: toY - 9, size: 8, font: helvBold, color: black });
      toY -= 11;
      page.drawText(dcAddress.name, { x: ix + halfW, y: toY - 9, size: 8, font: helvBold, color: black });
      toY -= 10;
      for (const line of [dcAddress.line1, dcAddress.line2, dcAddress.line3, dcAddress.line4, dcAddress.line5, dcAddress.line6]) {
        if (line) {
          page.drawText(line, { x: ix + halfW, y: toY - 8, size: 7, font: helv, color: black });
          toY -= 9;
        }
      }

      // Shipment Name black bar
      const barY = iy + 78;
      const barH = 14;
      page.drawRectangle({ x: ix, y: barY, width: iw, height: barH, color: black });
      const barText = `Shipment Name: ${shipment.name}`;
      const barTextSize = 9;
      const barTextWidth = helvBold.widthOfTextAtSize(barText, barTextSize);
      page.drawText(barText, {
        x: ix + (iw - barTextWidth) / 2,
        y: barY + (barH - barTextSize) / 2 + 1,
        size: barTextSize,
        font: helvBold,
        color: rgb(1, 1, 1),
      });

      // "PO Number: XXX" centered
      const poText = `PO Number: ${shipment.po_number}`;
      const poTextSize = 11;
      const poTextWidth = helvBold.widthOfTextAtSize(poText, poTextSize);
      page.drawText(poText, {
        x: ix + (iw - poTextWidth) / 2,
        y: barY - 16,
        size: poTextSize,
        font: helvBold,
        color: black,
      });

      // Barcode
      if (poBarcodeImg) {
        const bcW = Math.min(iw - 20, 220);
        const bcH = 36;
        page.drawImage(poBarcodeImg, {
          x: ix + (iw - bcW) / 2,
          y: barY - 16 - bcH - 4,
          width: bcW,
          height: bcH,
        });
      }

      // Bottom row: "Internal Use Only" (left)  +  "Box ___ of ___" (right)
      const bottomY = iy + 4;
      page.drawText("Internal Use Only", { x: ix, y: bottomY, size: 8, font: helv, color: black });
      // "Box _____ of _____"
      const boxText1 = "Box ";
      const blankLine = "______";
      const boxText2 = " of ";
      page.drawText(boxText1, { x: ix + halfW + 10, y: bottomY, size: 9, font: helv, color: black });
      const w1 = helv.widthOfTextAtSize(boxText1, 9);
      page.drawText(blankLine, { x: ix + halfW + 10 + w1, y: bottomY, size: 9, font: helv, color: black });
      const w2 = helv.widthOfTextAtSize(blankLine, 9);
      page.drawText(boxText2, { x: ix + halfW + 10 + w1 + w2, y: bottomY, size: 9, font: helv, color: black });
      const w3 = helv.widthOfTextAtSize(boxText2, 9);
      page.drawText(blankLine, { x: ix + halfW + 10 + w1 + w2 + w3, y: bottomY, size: 9, font: helv, color: black });
    }
  }

  return Buffer.from(await pdfDoc.save());
}

// =====================================================================
// PDF 3: PRODUCT LABELS — 45-up A4 (5 cols × 9 rows portrait)
// =====================================================================
// Note: Takealot's product label uses EAN-13 format barcodes
// Each item shows: Product title (wrapped 2-3 lines), "MP" vertical text, EAN-13 barcode

export async function generateProductLabelsPdf({ items, usedSkip = 0 }) {
  // `items` is an array of { barcode, title }, one entry PER UNIT
  // So if you have 2x SKU-A and 1x SKU-B, items would be 3 entries total
  const pdfDoc = await PDFDocument.create();
  const helv = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helvBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const black = rgb(0, 0, 0);

  // 45-up grid: 5 columns × 9 rows on A4 portrait
  // Matches Avery L7654 / similar 45-up label sheet
  // Each label is roughly 42mm × 25mm
  // We'll start labels from the BOTTOM of the page (like Takealot does)
  const COLS = 5;
  const ROWS = 9;
  const cellW = A4_WIDTH / COLS;   // ~119pt
  const cellH = A4_HEIGHT / ROWS;  // ~94pt

  const labelsPerPage = COLS * ROWS;
  const skip = Math.max(0, Math.min(labelsPerPage - 1, usedSkip || 0));
  const totalPages = Math.ceil((items.length + skip) / labelsPerPage);
  let labelsDrawn = 0;

  // Pre-generate all barcodes (cache by barcode string)
  const barcodeCache = {};
  for (const item of items) {
    const code = String(item.barcode || "");
    if (!code || barcodeCache[code]) continue;
    try {
      // Use EAN-13 barcode to match Takealot exactly
      const png = await makeBarcodePng(code, {
        bcid: "ean13",
        scale: 2,
        height: 12,
        includetext: true,
        textsize: 8,
      });
      barcodeCache[code] = await pdfDoc.embedPng(png);
    } catch (e) {
      // If EAN-13 fails (bad check digit etc), fallback to code128
      try {
        const png = await makeBarcodePng(code, {
          bcid: "code128",
          scale: 2,
          height: 12,
          includetext: true,
          textsize: 8,
        });
        barcodeCache[code] = await pdfDoc.embedPng(png);
      } catch (e2) {
        barcodeCache[code] = null;
      }
    }
  }

  for (let pageNum = 0; pageNum < totalPages; pageNum++) {
    const page = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT]);

    // Takealot fills labels starting from BOTTOM-LEFT and going right then up
    // (per screenshot 4 — the 3 labels were on bottom-left of page)
    // On page 1, skip the first N cells (labels already used)
    const startCell = pageNum === 0 ? skip : 0;
    for (let cell = startCell; cell < labelsPerPage; cell++) {
      if (labelsDrawn >= items.length) break;
      const item = items[labelsDrawn];
      labelsDrawn++;

      // Bottom-up, left-to-right ordering
      const col = cell % COLS;
      const rowFromBottom = Math.floor(cell / COLS);
      const ox = col * cellW;
      const oy = rowFromBottom * cellH;  // measured from bottom

      // Draw one product label
      const padding = 4;
      const ix = ox + padding;
      const iy = oy + padding;
      const iw = cellW - 2 * padding;
      const ih = cellH - 2 * padding;

      // Product title (top of label, max 3 lines, wrapped)
      const titleSize = 6.5;
      const title = item.title || "";
      const maxLineW = iw - 22; // leave space for "MP" on left side
      const words = title.split(" ");
      let lines = [];
      let current = "";
      for (const w of words) {
        const test = current + (current ? " " : "") + w;
        if (helvBold.widthOfTextAtSize(test, titleSize) > maxLineW) {
          if (current) lines.push(current);
          current = w;
        } else {
          current = test;
        }
      }
      if (current) lines.push(current);
      lines = lines.slice(0, 3);

      // Draw title from top of label
      let textY = iy + ih - titleSize - 2;
      for (const line of lines) {
        page.drawText(line, { x: ix + 2, y: textY, size: titleSize, font: helvBold, color: black });
        textY -= titleSize + 1;
      }

      // Draw "MP" vertical on left side of barcode
      page.drawText("M", { x: ix + 2, y: iy + 26, size: 8, font: helvBold, color: black });
      page.drawText("P", { x: ix + 2, y: iy + 18, size: 8, font: helvBold, color: black });

      // Draw barcode below title — bottom-aligned
      const bc = barcodeCache[String(item.barcode || "")];
      if (bc) {
        const bcW = iw - 14;
        const bcH = 26;
        page.drawImage(bc, { x: ix + 12, y: iy + 2, width: bcW, height: bcH });
      } else {
        page.drawText(`[${item.barcode || "no barcode"}]`, { x: ix + 12, y: iy + 14, size: 7, font: helv, color: black });
      }
    }
  }

  return Buffer.from(await pdfDoc.save());
}

// =====================================================================
// HELPER: Build seller info from env / defaults
// =====================================================================

export function getDefaultSellerInfo() {
  return {
    sellerId: process.env.TAKEALOT_SELLER_ID || "29835178",
    company: "DOORS DELIVERED (PTY) LTD",
    addressLines: [
      "15 JB McIntosh Drive",
      "Shongweni",
      "Shongweni",
      "3680",
    ],
  };
}

export function getDcAddress(warehouseName) {
  const code = dcCodeFromWarehouse(warehouseName);
  return TAKEALOT_DC_ADDRESSES[code] || TAKEALOT_DC_ADDRESSES.JHB;
}
