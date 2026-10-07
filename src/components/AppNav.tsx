"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { isActivePath, NAV_ITEMS } from "@/lib/navigation";
import {
  NAV_EXPANDED_STORAGE_KEY,
  defaultNavExpanded,
  parseStoredExpanded,
  shouldAutoCollapse,
} from "@/lib/nav-collapse";
import NavIcon from "./NavIcon";

interface AppNavProps {
  footer?: ReactNode;
  railFooter?: ReactNode;
}

function isTabletViewport(): boolean {
  return window.matchMedia("(min-width: 768px) and (max-width: 1023px)").matches;
}

function supportsAutoCollapse(): boolean {
  return window.matchMedia("(min-width: 768px)").matches;
}

export default function AppNav({ footer, railFooter }: AppNavProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const lastInteractionRef = useRef(0);

  useEffect(() => {
    let stored: boolean | null = null;
    try {
      stored = parseStoredExpanded(
        window.localStorage.getItem(NAV_EXPANDED_STORAGE_KEY),
      );
    } catch {
      stored = null;
    }
    setExpanded(stored ?? defaultNavExpanded(isTabletViewport()));
  }, []);

  const registerInteraction = useCallback(() => {
    lastInteractionRef.current = Date.now();
  }, []);

  const persistExpanded = useCallback((value: boolean) => {
    try {
      window.localStorage.setItem(NAV_EXPANDED_STORAGE_KEY, String(value));
    } catch {
      // `localStorage` indisponível: a preferência vale apenas em memória.
    }
  }, []);

  const toggleExpanded = useCallback(() => {
    setExpanded((value) => {
      const next = !value;
      persistExpanded(next);
      return next;
    });
  }, [persistExpanded]);

  useEffect(() => {
    if (!expanded || !supportsAutoCollapse()) return;

    lastInteractionRef.current = Date.now();
    const timer = window.setInterval(() => {
      if (shouldAutoCollapse(lastInteractionRef.current, Date.now())) {
        setExpanded(false);
        persistExpanded(false);
      }
    }, 1000);

    return () => window.clearInterval(timer);
  }, [expanded, persistExpanded]);

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
        onPointerMove={registerInteraction}
        onFocus={registerInteraction}
        onClick={registerInteraction}
        className={`${
          open ? "flex" : "hidden"
        } flex-col border-b border-border bg-surface p-2 transition-[width] duration-200 md:sticky md:top-0 md:flex md:h-screen md:shrink-0 md:overflow-y-auto md:border-b-0 md:border-r md:p-4 ${
          expanded ? "md:w-64" : "md:w-[4.5rem]"
        }`}
      >
        <div className="mb-3 hidden items-center justify-between gap-2 md:flex">
          {expanded && (
            <span className="px-1 text-lg font-bold text-foreground">
              FinFam
            </span>
          )}
          <button
            type="button"
            onClick={toggleExpanded}
            aria-expanded={expanded}
            aria-controls="app-menu"
            aria-label={expanded ? "Recolher menu" : "Expandir menu"}
            title={expanded ? "Recolher menu" : "Expandir menu"}
            className="ml-auto rounded-lg border border-border-strong p-1.5 text-foreground-muted transition hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
          >
            <span aria-hidden="true" className="block text-sm leading-none">
              {expanded ? "«" : "»"}
            </span>
          </button>
        </div>

        <ul className="flex-1 space-y-1">
          {NAV_ITEMS.map((item) => {
            const active = isActivePath(pathname, item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  title={expanded ? undefined : item.label}
                  className={`flex items-center gap-3 rounded-lg border-l-4 px-3 py-2 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
                    active
                      ? "border-emerald-500 bg-emerald-500/15 font-bold text-emerald-200"
                      : "border-transparent text-foreground-muted hover:bg-surface-raised hover:text-foreground"
                  } ${expanded ? "" : "md:justify-center md:px-2"}`}
                >
                  <NavIcon name={item.icon} className="h-5 w-5 shrink-0" />
                  <span className={expanded ? "" : "md:sr-only"}>
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
