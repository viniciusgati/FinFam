"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import AppNav from "./AppNav";

type LogoutState = "idle" | "loading" | "error";

interface AppShellProps {
  user: string;
  children: ReactNode;
}

export default function AppShell({ user, children }: AppShellProps) {
  const router = useRouter();
  const [logoutState, setLogoutState] = useState<LogoutState>("idle");

  async function handleLogout(): Promise<void> {
    setLogoutState("loading");
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error("Falha ao sair");
      router.push("/login");
      router.refresh();
    } catch {
      setLogoutState("error");
    }
  }

  const loading = logoutState === "loading";
  const logoutLabel = loading ? "Saindo..." : "Sair";

  return (
    <div className="flex min-h-screen flex-col bg-canvas md:flex-row">
      <AppNav
        footer={
          <div className="space-y-2">
            <p className="px-3 text-xs text-subtle">Conectado como {user}</p>
            <button
              type="button"
              onClick={handleLogout}
              disabled={loading}
              aria-busy={loading}
              className="w-full rounded-lg border border-border-strong px-3 py-2 text-sm font-medium text-foreground-muted transition hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 disabled:opacity-60"
            >
              {logoutLabel}
            </button>
            <p aria-live="polite" className="min-h-5 px-1 text-xs text-red-400">
              {logoutState === "error"
                ? "Não foi possível sair. Tente novamente."
                : ""}
            </p>
          </div>
        }
        railFooter={
          <button
            type="button"
            onClick={handleLogout}
            disabled={loading}
            aria-busy={loading}
            aria-label={logoutLabel}
            title={logoutLabel}
            className="flex w-full items-center justify-center rounded-lg border border-border-strong p-2 text-foreground-muted transition hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 disabled:opacity-60"
          >
            <svg
              aria-hidden="true"
              focusable="false"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5"
            >
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
              <path d="M16 17l5-5-5-5" />
              <path d="M21 12H9" />
            </svg>
          </button>
        }
      />
      <main className="min-w-0 flex-1 p-4 sm:p-6 md:p-8">{children}</main>
    </div>
  );
}
