"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Empty, Notice } from "@/components/ui";
import { ago, shortDate } from "@/lib/format";

const TONE = { admin: "accent", staff: "info", pending: "warn" };

function UserRow({ u, me, onMsg }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function setRole(role) {
    if (role === "pending" && !window.confirm(`Revoke access for ${u.full_name || u.email}? They won't be able to sign in until approved again.`)) return;
    setBusy(true);
    const res = await fetch(`/api/users/${u.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role }) });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { onMsg({ tone: "bad", text: d.error || "Couldn't update" }); return; }
    onMsg({ tone: "ok", text: `${u.full_name || u.email} is now ${role}.` });
    router.refresh();
  }
  const isMe = u.id === me;
  return (
    <tr>
      <td className="font-medium">{u.full_name || "—"} {isMe ? <span className="text-faint font-normal">(you)</span> : null}</td>
      <td className="text-muted">{u.email}</td>
      <td><Badge tone={TONE[u.role] || "neutral"}>{u.role}</Badge></td>
      <td className="text-muted whitespace-nowrap" title={shortDate(u.created_at)}>{ago(u.created_at)}</td>
      <td className="text-muted whitespace-nowrap">{u.approved_at ? shortDate(u.approved_at) : "—"}</td>
      <td className="r whitespace-nowrap">
        {isMe ? <span className="text-[11px] text-faint">—</span> : u.role === "pending" ? (
          <div className="inline-flex gap-1">
            <Button size="sm" variant="primary" disabled={busy} onClick={() => setRole("staff")}>Approve as staff</Button>
            <Button size="sm" disabled={busy} onClick={() => setRole("admin")}>As admin</Button>
          </div>
        ) : (
          <div className="inline-flex gap-1 items-center">
            <select className="input !h-[26px] !w-auto text-[12px]" value={u.role} disabled={busy} onChange={(e) => setRole(e.target.value)} aria-label="Role">
              <option value="staff">Staff</option>
              <option value="admin">Admin</option>
            </select>
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => setRole("pending")}>Revoke</Button>
          </div>
        )}
      </td>
    </tr>
  );
}

function Table({ rows, me, onMsg }) {
  return (
    <table className="tbl">
      <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Signed up</th><th>Approved</th><th className="r">Actions</th></tr></thead>
      <tbody>{rows.map((u) => <UserRow key={u.id} u={u} me={me} onMsg={onMsg} />)}</tbody>
    </table>
  );
}

export default function UsersTable({ users, me }) {
  const [msg, setMsg] = useState(null);
  const pending = users.filter((u) => u.role === "pending");
  const active = users.filter((u) => u.role !== "pending");
  return (
    <div className="grid gap-3">
      {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}
      <section className="bg-panel border border-line rounded-md">
        <h2 className="px-3 h-9 flex items-center text-[12px] font-semibold uppercase tracking-wide text-muted border-b border-line">Waiting for approval · {pending.length}</h2>
        {pending.length ? <Table rows={pending} me={me} onMsg={setMsg} /> : <Empty>No one is waiting.</Empty>}
      </section>
      <section className="bg-panel border border-line rounded-md">
        <h2 className="px-3 h-9 flex items-center text-[12px] font-semibold uppercase tracking-wide text-muted border-b border-line">Team · {active.length}</h2>
        <Table rows={active} me={me} onMsg={setMsg} />
      </section>
      <p className="text-[11px] text-faint">Staff can view products and export. Admins can edit products, map SKUs, import and manage users.</p>
    </div>
  );
}
