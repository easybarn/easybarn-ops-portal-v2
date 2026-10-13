import { NextResponse } from "next/server";
import { apiUser, fail } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase-admin";

const ROLES = ["pending", "staff", "admin"];

// Body: { role }
export async function PATCH(request, { params }) {
  const { ctx, res } = await apiUser({ admin: true });
  if (res) return res;
  const { id } = await params;
  const { role } = await request.json().catch(() => ({}));
  if (!ROLES.includes(role)) return fail(new Error("Role must be pending, staff or admin"), 400);
  if (id === ctx.user.id && role !== "admin") return fail(new Error("You can't remove your own admin access"), 400);

  const admin = createAdminClient();
  const { data: target } = await admin.from("profiles").select("role, approved_at").eq("id", id).maybeSingle();
  if (!target) return fail(new Error("User not found"), 404);

  const patch = { role };
  if (role !== "pending" && !target.approved_at) patch.approved_at = new Date().toISOString();
  if (role === "pending") patch.approved_at = null;
  const { data, error } = await admin.from("profiles").update(patch).eq("id", id).select().single();
  if (error) return fail(error);
  return NextResponse.json({ profile: data });
}
