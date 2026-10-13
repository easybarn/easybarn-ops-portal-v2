import "server-only";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

async function current() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, profile: null };
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  return { supabase, user, profile };
}

// Pages: signed-in, approved user (redirects otherwise)
export async function requireUser() {
  const { user, profile } = await current();
  if (!user) redirect("/login");
  if (!profile || profile.role === "pending") redirect("/pending");
  return { user, profile, isAdmin: profile.role === "admin" };
}

export async function requireAdmin() {
  const ctx = await requireUser();
  if (!ctx.isAdmin) redirect("/dashboard");
  return ctx;
}

// API routes: returns { ctx } or { res } (an error response to return)
export async function apiUser({ admin = false } = {}) {
  const ctx = await current();
  if (!ctx.user) return { res: NextResponse.json({ error: "Not signed in" }, { status: 401 }) };
  if (!ctx.profile || ctx.profile.role === "pending") {
    return { res: NextResponse.json({ error: "Account awaiting approval" }, { status: 403 }) };
  }
  if (admin && ctx.profile.role !== "admin") {
    return { res: NextResponse.json({ error: "Admins only" }, { status: 403 }) };
  }
  return { ctx: { ...ctx, isAdmin: ctx.profile.role === "admin" } };
}

export const fail = (e, status = 500) =>
  NextResponse.json({ error: e?.message || String(e) }, { status });
