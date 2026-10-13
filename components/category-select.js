"use client";

import { useState } from "react";

// Dropdown of known categories plus "Other…" to type a new one.
export default function CategorySelect({ value, onChange, categories, disabled }) {
  const known = categories.includes(value || "");
  const [custom, setCustom] = useState(!!value && !known);
  if (custom) {
    return (
      <div className="flex gap-1">
        <input className="input" value={value || ""} onChange={(e) => onChange(e.target.value.toUpperCase())} placeholder="NEW CATEGORY" disabled={disabled} autoFocus />
        <button type="button" className="text-[12px] text-muted hover:text-ink px-1" onClick={() => { setCustom(false); onChange(""); }} disabled={disabled}>List</button>
      </div>
    );
  }
  return (
    <select className="input" value={value || ""} disabled={disabled}
      onChange={(e) => (e.target.value === "__other" ? (setCustom(true), onChange("")) : onChange(e.target.value))}>
      <option value="">Choose…</option>
      {categories.map((c) => <option key={c} value={c}>{c}</option>)}
      <option value="__other">Other…</option>
    </select>
  );
}
