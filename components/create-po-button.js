"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FilePlus2 } from "lucide-react";
import { Button } from "./ui";

// Creates a draft PO (Doors Delivered → Panel & Pane) from a Shopify order, then opens it
export default function CreatePoButton({ orderKey, size, compact }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function create(e) {
    e.stopPropagation();
    setBusy(true);
    const res = await fetch("/api/purchase-orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderKey }) });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    // Stay on the page: the PO is now a draft in the send queue, and the refresh swaps this button for its number
    if (res.ok || (res.status === 409 && d.po)) { router.refresh(); return; }
    window.alert(d.error || "Couldn't create the PO");
  }
  return (
    <Button size={size} onClick={create} disabled={busy} title="Create a draft PO to Panel & Pane and add it to the send queue">
      <FilePlus2 size={size === "sm" ? 12 : 14} /> {busy ? "Creating…" : compact ? "PO" : "Create PO"}
    </Button>
  );
}
