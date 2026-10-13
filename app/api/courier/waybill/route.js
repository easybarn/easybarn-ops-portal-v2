import { NextResponse } from "next/server";
import { apiUser, fail } from "@/lib/auth";
import { tcgGetLabel } from "@/lib/courier";

// GET ?ref=XXXX → redirects to the signed waybill PDF
export async function GET(request) {
  const { res } = await apiUser();
  if (res) return res;
  const ref = new URL(request.url).searchParams.get("ref");
  if (!ref) return fail(new Error("Missing ref"), 400);
  try {
    const d = await tcgGetLabel(ref);
    if (!d.url) return fail(new Error("The Courier Guy returned no waybill"), 502);
    return NextResponse.redirect(d.url);
  } catch (e) { return fail(e, 502); }
}
