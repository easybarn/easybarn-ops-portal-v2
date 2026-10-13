import Link from "next/link";

const cx = (...a) => a.filter(Boolean).join(" ");
export { cx };

export function PageHeader({ title, sub, crumbs, actions }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
      <div className="min-w-0">
        {crumbs ? (
          <div className="text-[11px] text-faint mb-1 flex gap-1.5">
            {crumbs.map((c, i) => (
              <span key={i} className="flex gap-1.5">
                {c.href ? <Link href={c.href} className="hover:text-ink">{c.label}</Link> : <span>{c.label}</span>}
                {i < crumbs.length - 1 ? <span>/</span> : null}
              </span>
            ))}
          </div>
        ) : null}
        <h1 className="text-[17px] font-semibold tracking-tight leading-tight">{title}</h1>
        {sub ? <p className="text-muted mt-0.5">{sub}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

const BTN = {
  primary: "bg-accent text-accent-ink border-accent hover:brightness-110",
  default: "bg-panel text-ink border-line-strong hover:bg-hover",
  ghost: "bg-transparent text-muted border-transparent hover:text-ink hover:bg-hover",
  danger: "bg-panel text-bad border-line-strong hover:bg-bad-soft",
};
export function btnClass(variant = "default", size = "md") {
  return cx(
    "inline-flex items-center justify-center gap-1.5 border rounded-[5px] font-medium whitespace-nowrap transition-colors disabled:opacity-50 disabled:pointer-events-none cursor-pointer",
    size === "sm" ? "h-[26px] px-2 text-[12px]" : "h-[30px] px-3 text-[13px]",
    BTN[variant]
  );
}
export function Button({ variant, size, className, ...p }) {
  return <button type="button" {...p} className={cx(btnClass(variant, size), className)} />;
}
export function LinkButton({ variant, size, className, ...p }) {
  return <Link {...p} className={cx(btnClass(variant, size), className)} />;
}

const TONES = {
  neutral: "bg-sunk text-muted",
  ok: "bg-ok-soft text-ok",
  warn: "bg-warn-soft text-warn",
  bad: "bg-bad-soft text-bad",
  info: "bg-info-soft text-info",
  accent: "bg-accent-soft text-accent",
};
export function Badge({ tone = "neutral", children, className }) {
  return (
    <span className={cx("inline-flex items-center gap-1 h-[18px] px-1.5 rounded-[4px] text-[10.5px] font-semibold uppercase tracking-wide whitespace-nowrap", TONES[tone], className)}>
      {children}
    </span>
  );
}

export function Panel({ title, actions, children, className, pad = true }) {
  return (
    <section className={cx("bg-panel border border-line rounded-md min-w-0", className)}>
      {title ? (
        <div className="flex items-center justify-between gap-2 px-3 h-9 border-b border-line">
          <h2 className="text-[12px] font-semibold uppercase tracking-wide text-muted">{title}</h2>
          {actions}
        </div>
      ) : null}
      <div className={pad ? "p-3" : ""}>{children}</div>
    </section>
  );
}

export function Field({ label, hint, children, className }) {
  return (
    <label className={cx("grid gap-1", className)}>
      <span className="text-[11px] font-medium text-muted">{label}</span>
      {children}
      {hint ? <span className="text-[11px] text-faint">{hint}</span> : null}
    </label>
  );
}

export function Stat({ label, value, tone, href, active }) {
  const body = (
    <>
      <div className="text-[10.5px] uppercase tracking-wide text-muted font-medium">{label}</div>
      <div className={cx("num text-[18px] font-semibold leading-tight mt-0.5", tone === "warn" && "text-warn", tone === "bad" && "text-bad", tone === "ok" && "text-ok")}>{value}</div>
    </>
  );
  const cls = cx("block bg-panel border rounded-md px-3 py-2 min-w-0", active ? "border-accent ring-1 ring-accent" : "border-line", href && "hover:border-line-strong");
  return href ? <Link href={href} className={cls}>{body}</Link> : <div className={cls}>{body}</div>;
}

export function Notice({ tone = "info", children }) {
  return <div className={cx("rounded-md px-3 py-2 text-[13px] border border-line", TONES[tone])}>{children}</div>;
}

export function Empty({ children }) {
  return <div className="py-10 text-center text-muted">{children}</div>;
}

export function MpDot({ mp }) {
  const c = { shopify: "bg-pink-500", takealot: "bg-blue-500", leroymerlin: "bg-green-500" }[mp] || "bg-gray-400";
  return <span className={cx("inline-block w-1.5 h-1.5 rounded-full shrink-0", c)} />;
}
