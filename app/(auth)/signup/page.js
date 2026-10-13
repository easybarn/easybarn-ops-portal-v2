"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase-client";
import { Button, Field, Notice } from "@/components/ui";

export default function SignupPage() {
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    if (form.password.length < 8) { setError("Use at least 8 characters for the password."); return; }
    setBusy(true); setError("");
    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email: form.email.trim(),
      password: form.password,
      options: { data: { full_name: form.name.trim() } },
    });
    if (error) { setError(error.message); setBusy(false); return; }
    await supabase.auth.signOut();
    window.location.href = "/pending";
  }

  return (
    <form onSubmit={submit} className="grid gap-3">
      <div>
        <h1 className="text-[16px] font-semibold">Request access</h1>
        <p className="text-muted">An admin approves new accounts before first use.</p>
      </div>
      {error ? <Notice tone="bad">{error}</Notice> : null}
      <Field label="Full name"><input className="input" required value={form.name} onChange={set("name")} autoFocus /></Field>
      <Field label="Email"><input className="input" type="email" autoComplete="email" required value={form.email} onChange={set("email")} /></Field>
      <Field label="Password" hint="At least 8 characters"><input className="input" type="password" autoComplete="new-password" required value={form.password} onChange={set("password")} /></Field>
      <Button type="submit" variant="primary" disabled={busy} className="w-full mt-1">{busy ? "Sending…" : "Request access"}</Button>
      <p className="text-[12px] text-muted text-center">Already approved? <Link href="/login" className="text-accent hover:underline">Sign in</Link></p>
    </form>
  );
}
