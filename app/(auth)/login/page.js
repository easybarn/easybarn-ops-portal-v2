"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase-client";
import { Button, Field, Notice } from "@/components/ui";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError("");
    const supabase = createClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) { setError(error.message); setBusy(false); return; }
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", data.user.id).maybeSingle();
    if (!profile || profile.role === "pending") {
      await supabase.auth.signOut();
      window.location.href = "/pending";
      return;
    }
    window.location.href = "/dashboard";
  }

  return (
    <form onSubmit={submit} className="grid gap-3">
      <div>
        <h1 className="text-[16px] font-semibold">Sign in</h1>
        <p className="text-muted">Easy Barn operations console</p>
      </div>
      {error ? <Notice tone="bad">{error}</Notice> : null}
      <Field label="Email"><input className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoFocus /></Field>
      <Field label="Password"><input className="input" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
      <Button type="submit" variant="primary" disabled={busy} className="w-full mt-1">{busy ? "Signing in…" : "Sign in"}</Button>
      <p className="text-[12px] text-muted text-center">New to the team? <Link href="/signup" className="text-accent hover:underline">Request access</Link></p>
    </form>
  );
}
