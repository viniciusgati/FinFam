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
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
        <span className="text-lg font-bold text-slate-900">FinFam</span>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls="app-menu"
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
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
        } flex-col border-b border-slate-200 bg-white p-2 lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-64 lg:shrink-0 lg:overflow-y-auto lg:border-b-0 lg:border-r lg:p-4`}
      >
        <span className="mb-2 hidden px-3 text-lg font-bold text-slate-900 lg:block">
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
                  className={`block rounded-lg border-l-4 px-3 py-2 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 ${
                    active
                      ? "border-emerald-600 bg-emerald-50 font-bold text-emerald-900"
                      : "border-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900"
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
          <div className="mt-4 border-t border-slate-200 pt-4">{footer}</div>
        )}
      </nav>
    </>
  );
}
