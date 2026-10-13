"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { btnClass, cx } from "./ui";

// Re-fetches the current page's server data (e.g. latest Shopify orders) without a full reload
export default function RefreshButton({ label = "Refresh" }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [at, setAt] = useState(null);
  return (
    <button
      type="button"
      className={btnClass()}
      disabled={pending}
      title={at ? `Last refreshed ${at}` : "Fetch the latest from Shopify"}
      onClick={() => start(() => { router.refresh(); setAt(new Date().toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" })); })}
    >
      <RefreshCw size={14} className={cx(pending && "animate-spin")} />
      {pending ? "Refreshing…" : label}
    </button>
  );
}
