export function pdfResponse(bytes, name) {
  return new Response(bytes, {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${String(name).replace(/[^a-zA-Z0-9-]/g, "_")}.pdf"`, "Cache-Control": "no-store" },
  });
}
