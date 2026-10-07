"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { isActivePath, NAV_ITEMS } from "@/lib/navigation";

interface AppNavProps {
  footer?: ReactNode;
}

export default function AppNav({ footer }: AppNavProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="flex items-center justify-between border-b border-border bg-surface px-4 py-3 lg:hidden">
        <span className="text-lg font-bold text-foreground">FinFam</span>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls="app-menu"
          className="rounded-lg border border-border-strong px-3 py-1.5 text-sm font-medium text-foreground-muted transition hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
        >
          <span aria-hidden="true">{open ? "✕" : "☰"}</span>
          <span className="sr-only">{open ? "Fechar menu" : "Abrir menu"}</span>
        </button>
      </div>

      <nav
        id="app-menu"
        aria-label="Navegação principal"
        className={`${
          open ? "flex" : "hidden"
        } flex-col border-b border-border bg-surface p-2 lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-64 lg:shrink-0 lg:overflow-y-auto lg:border-b-0 lg:border-r lg:p-4`}
      >
        <span className="mb-2 hidden px-3 text-lg font-bold text-foreground lg:block">
          FinFam
        </span>
        <ul className="flex-1 space-y-1">
          {NAV_ITEMS.map((item) => {
            const active = isActivePath(pathname, item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`block rounded-lg border-l-4 px-3 py-2 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
                    active
                      ? "border-emerald-500 bg-emerald-500/15 font-bold text-emerald-200"
                      : "border-transparent text-foreground-muted hover:bg-surface-raised hover:text-foreground"
                  }`}
                >
                  <span aria-hidden="true" className="mr-2 inline-block w-3">
                    {active ? "▸" : ""}
                  </span>
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
        {footer && (
          <div className="mt-4 border-t border-border pt-4">{footer}</div>
        )}
      </nav>
    </>
  );
}
