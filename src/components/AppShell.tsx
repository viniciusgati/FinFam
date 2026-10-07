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

  return (
    <div className="flex min-h-screen flex-col bg-canvas lg:flex-row">
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
              {loading ? "Saindo..." : "Sair"}
            </button>
            <p aria-live="polite" className="min-h-5 px-1 text-xs text-red-400">
              {logoutState === "error"
                ? "Não foi possível sair. Tente novamente."
                : ""}
            </p>
          </div>
        }
      />
      <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
    </div>
  );
}
