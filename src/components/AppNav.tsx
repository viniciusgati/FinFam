"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { isActivePath, NAV_ITEMS } from "@/lib/navigation";
import { readNavExpanded, writeNavExpanded } from "@/lib/nav-collapse";
import { CollapseIcon, NAV_ICONS } from "@/components/NavIcons";

interface AppNavProps {
  footer?: ReactNode;
  /** Sair (botão compacto) exibido apenas no trilho colapsado (≥768px). */
  railFooter?: ReactNode;
  /** Estado inicial do trilho (≥768px). Padrão de produção: expandido. */
  initialExpanded?: boolean;
}

export default function AppNav({
  footer,
  railFooter,
  initialExpanded = true,
}: AppNavProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(initialExpanded);

  // Preferência persistida é aplicada só após a hidratação: o primeiro paint
  // é idêntico entre servidor e cliente (sem mismatch).
  useEffect(() => {
    setExpanded(readNavExpanded());
  }, []);

  function toggleExpanded() {
    const next = !expanded;
    setExpanded(next);
    writeNavExpanded(next);
  }

  const collapseLabel = expanded ? "Recolher menu" : "Expandir menu";

  return (
    <>
      <div className="flex items-center justify-between border-b border-border bg-surface px-4 py-3 md:hidden">
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
        className={`${open ? "flex" : "hidden"} flex-col border-b border-border bg-surface p-2 transition-[width] duration-200 md:sticky md:top-0 md:flex md:h-screen md:shrink-0 md:overflow-y-auto md:border-b-0 md:border-r ${
          expanded ? "md:w-64 md:p-4" : "md:w-16"
        }`}
      >
        <span
          className={`mb-2 hidden px-3 text-lg font-bold text-foreground ${
            expanded ? "md:block" : ""
          }`}
        >
          FinFam
        </span>

        <button
          type="button"
          onClick={toggleExpanded}
          aria-expanded={expanded}
          aria-controls="app-menu"
          title={collapseLabel}
          className={`mb-2 hidden items-center gap-2 rounded-lg border border-border-strong px-3 py-2 text-sm font-medium text-foreground-muted transition hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 md:flex ${
            expanded ? "" : "md:justify-center md:px-0"
          }`}
        >
          <CollapseIcon
            className={`h-5 w-5 shrink-0 transition-transform ${
              expanded ? "" : "rotate-180"
            }`}
          />
          <span className="sr-only">{collapseLabel}</span>
        </button>

        <ul className="flex-1 space-y-1">
          {NAV_ITEMS.map((item) => {
            const active = isActivePath(pathname, item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  title={item.label}
                  className={`flex items-center gap-3 rounded-lg border-l-4 px-3 py-2 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
                    expanded ? "" : "md:px-0"
                  } ${
                    active
                      ? "border-emerald-500 bg-emerald-500/15 font-bold text-emerald-200"
                      : "border-transparent text-foreground-muted hover:bg-surface-raised hover:text-foreground"
                  } ${expanded ? "" : "md:justify-center md:px-2"}`}
                >
                  <span
                    aria-hidden="true"
                    className="flex shrink-0 items-center justify-center"
                  >
                    {NAV_ICONS[item.icon]}
                  </span>
                  <span className={expanded ? undefined : "md:sr-only"}>
                    {item.label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>

        {footer && (
          <div
            className={`mt-4 border-t border-border pt-4 ${
              expanded ? "" : "md:hidden"
            }`}
          >
            {footer}
          </div>
        )}

        {railFooter && (
          <div
            className={`mt-4 border-t border-border pt-4 ${
              expanded ? "hidden" : "hidden md:block"
            }`}
          >
            {railFooter}
          </div>
        )}
      </nav>
    </>
  );
}
