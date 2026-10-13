"use client";

import { useEffect, useState } from "react";
import { HelpCircle, X } from "lucide-react";

// "Process" button + popup that explains a workflow step by step.
// steps: [[label, text, where?], ...]
export default function ProcessDialog({ title, flow, intro, steps, footer, label = "Process", className }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const k = (e) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open]);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className || "inline-flex items-center gap-1.5 h-[30px] px-3 rounded-[5px] border border-line-strong bg-panel hover:bg-hover font-medium"} title={`How the ${title.toLowerCase()} works`}>
        <HelpCircle size={14} /> {label}
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 bg-black/45 flex items-start md:items-center justify-center p-3 overflow-y-auto" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div role="dialog" aria-modal="true" aria-label={title} className="bg-panel border border-line rounded-md w-full max-w-[720px] shadow-2xl">
            <div className="flex items-center gap-2 px-4 h-11 border-b border-line">
              <HelpCircle size={15} className="text-accent" />
              <b>{title}</b>
              {flow ? <span className="text-muted text-[12px] hidden sm:inline">{flow}</span> : null}
              <button className="ml-auto p-1 text-muted hover:text-ink" onClick={() => setOpen(false)} aria-label="Close"><X size={16} /></button>
            </div>
            <div className="p-4">
              {intro ? <p className="text-muted text-[12px] mb-3">{intro}</p> : null}
              <table className="tbl">
                <thead><tr><th className="w-[150px]">Step</th><th>What happens</th><th className="w-[120px]">Where</th></tr></thead>
                <tbody>
                  {steps.map(([step, text, where]) => (
                    <tr key={step}>
                      <td className="font-semibold align-top">{step}</td>
                      <td className="align-top leading-relaxed">{text}</td>
                      <td className="align-top text-[12px] text-muted">{where || ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {footer ? <div className="text-[12px] text-muted mt-3">{footer}</div> : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
