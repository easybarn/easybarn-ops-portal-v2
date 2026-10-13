import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { apiUser, fail } from "@/lib/auth";
import { createClient } from "@/lib/supabase-server";
import { normaliseImportRow, diffImport } from "@/lib/products";

// multipart: file=<xlsx|csv>, ?action=preview|apply
export async function POST(request) {
  const { ctx, res } = await apiUser({ admin: true });
  if (res) return res;
  const action = new URL(request.url).searchParams.get("action") || "preview";

  let incoming;
  try {
    const file = (await request.formData()).get("file");
    if (!file) return fail(new Error("No file uploaded"), 400);
    const wb = XLSX.read(await file.arrayBuffer());
    incoming = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]).map(normaliseImportRow).filter(Boolean);
  } catch (e) { return fail(new Error("Couldn't read that file: " + e.message), 400); }
  if (!incoming.length) return fail(new Error("No rows with a WAREHOUSE CODE column were found"), 400);

  const supabase = await createClient();
  const { data: current, error } = await supabase.from("products").select("*");
  if (error) return fail(error);
  const diff = diffImport(incoming, current || []);

  if (action !== "apply") {
    return NextResponse.json({
      summary: { rows: incoming.length, create: diff.create.length, update: diff.update.length, unchanged: diff.unchanged.length, duplicates: diff.duplicates },
      create: diff.create,
      update: diff.update,
    });
  }

  const errors = [];
  let created = 0, updated = 0;
  for (const row of diff.create) {
    const { error: e } = await supabase.from("products").insert({ ...row, active: true, updated_by: ctx.user.id });
    if (e) errors.push({ code: row.warehouse_code, error: e.message }); else created++;
  }
  for (const u of diff.update) {
    const { warehouse_code, ...row } = u.row;
    const { error: e } = await supabase.from("products").update({ ...row, updated_by: ctx.user.id }).eq("warehouse_code", warehouse_code);
    if (e) errors.push({ code: warehouse_code, error: e.message }); else updated++;
  }
  return NextResponse.json({ applied: true, created, updated, errors });
}
