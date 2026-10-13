"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Package, PackagePlus, FileSpreadsheet, CircleAlert, Users, LogOut, Menu,
  ShoppingBag, Truck, Printer, Store, ClipboardList, FileText, MessageCircle, ExternalLink,
} from "lucide-react";
import { cx } from "./ui";

// Old portal keeps Takealot / Leroy Merlin / WhatsApp until they are rebuilt here
const LEGACY = process.env.NEXT_PUBLIC_LEGACY_URL || "http://localhost:3000";

function Item({ href, icon: Icon, label, badge, exact, external, pathname, onNav }) {
  const active = !external && (exact ? pathname === href : pathname === href || pathname.startsWith(href + "/"));
  const cls = cx(
    "flex items-center gap-2.5 h-[30px] px-3 mx-2 rounded-[5px] text-[13px] transition-colors",
    active ? "bg-side-hover text-white" : "text-side-ink hover:bg-side-hover hover:text-white",
    external && "text-side-muted"
  );
  const inner = (
    <>
      <Icon size={15} strokeWidth={1.8} className={active ? "text-accent" : ""} />
      <span className="flex-1 truncate">{label}</span>
      {external ? <ExternalLink size={12} /> : null}
      {badge ? <span className="num text-[10.5px] px-1.5 rounded bg-accent text-accent-ink font-semibold">{badge}</span> : null}
    </>
  );
  return external ? (
    <a href={href} target="_blank" rel="noreferrer" className={cls}>{inner}</a>
  ) : (
    <Link href={href} className={cls} onClick={onNav} aria-current={active ? "page" : undefined}>{inner}</Link>
  );
}

const Section = ({ label, children }) => (
  <div className="mt-4">
    <div className="px-5 pb-1 text-[10px] font-semibold uppercase tracking-[.1em] text-side-muted">{label}</div>
    {children}
  </div>
);

export default function Shell({ profile, isAdmin, counts = {}, children }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  const nav = (
    <nav className="flex flex-col h-full bg-side text-side-ink">
      <Link href="/dashboard" className="flex items-center gap-2.5 h-12 px-4 border-b border-white/5" onClick={close}>
        <span className="bg-white rounded px-1.5 py-1 flex"><Image src="/logo.png" alt="Easy Barn" width={64} height={16} style={{ width: 64, height: "auto" }} priority /></span>
        <span className="text-[11px] font-semibold tracking-[.12em] text-side-muted">OPS v2</span>
      </Link>
      <div className="flex-1 overflow-y-auto pb-4">
        <div className="mt-3">
          <Item href="/dashboard" icon={LayoutDashboard} label="Overview" exact pathname={pathname} onNav={close} />
        </div>
        <Section label="Easy Barn · Shopify">
          <Item href="/orders" icon={ShoppingBag} label="Orders" badge={counts.toShip || null} pathname={pathname} onNav={close} />
          <Item href="/purchase-orders" icon={FileText} label="Purchase orders" pathname={pathname} onNav={close} />
          <Item href="/picking-slips" icon={ClipboardList} label="Picking slips" pathname={pathname} onNav={close} />
          <Item href="/shipping" icon={Printer} label="Print queue" pathname={pathname} onNav={close} />
        </Section>
        <Section label="Catalogue">
          <Item href="/products" icon={Package} label="Products" exact pathname={pathname} onNav={close} />
          {isAdmin ? <Item href="/products/unmapped" icon={CircleAlert} label="Unmapped SKUs" badge={counts.unmapped} pathname={pathname} onNav={close} /> : null}
          {isAdmin ? <Item href="/products/new" icon={PackagePlus} label="New product" pathname={pathname} onNav={close} /> : null}
          {isAdmin ? <Item href="/products/import" icon={FileSpreadsheet} label="Import / export" pathname={pathname} onNav={close} /> : null}
        </Section>
        {isAdmin ? (
          <Section label="Admin">
            <Item href="/users" icon={Users} label="Users" badge={counts.pendingUsers} pathname={pathname} onNav={close} />
          </Section>
        ) : null}
        <Section label="Old portal">
          <Item external href={`${LEGACY}/dashboard/leadtime`} icon={Store} label="Takealot" />
          <Item external href={`${LEGACY}/dashboard/leroymerlin/orders`} icon={Truck} label="Leroy Merlin" />
          <Item external href={`${LEGACY}/dashboard/whatsapp`} icon={MessageCircle} label="WhatsApp" />
        </Section>
      </div>
      <div className="border-t border-white/5 p-3 flex items-center gap-2">
        <div className="w-7 h-7 rounded-full bg-side-hover grid place-items-center text-[11px] font-semibold text-white shrink-0">
          {(profile.full_name || profile.email || "?").slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[12px] text-white truncate">{profile.full_name || profile.email}</div>
          <div className="text-[10.5px] text-side-muted uppercase tracking-wide">{profile.role}</div>
        </div>
        <button onClick={logout} title="Sign out" aria-label="Sign out" className="p-1.5 rounded hover:bg-side-hover text-side-muted hover:text-white">
          <LogOut size={15} />
        </button>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen md:grid md:grid-cols-[216px_1fr]">
      <aside className="hidden md:block sticky top-0 h-screen">{nav}</aside>

      {open ? (
        <div className="md:hidden fixed inset-0 z-40 flex">
          <div className="w-[240px] h-full">{nav}</div>
          <button aria-label="Close menu" className="flex-1 bg-black/40" onClick={close} />
        </div>
      ) : null}

      <div className="min-w-0">
        <div className="md:hidden sticky top-0 z-30 flex items-center gap-2 h-11 px-3 bg-side text-white">
          <button onClick={() => setOpen(true)} aria-label="Open menu" className="p-1"><Menu size={18} /></button>
          <span className="font-semibold text-[13px]">Easy Barn Ops</span>
        </div>
        <main className="px-4 md:px-6 py-5 max-w-[1500px]">{children}</main>
      </div>
    </div>
  );
}
