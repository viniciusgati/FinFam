"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type ConnectionStatus = "idle" | "checking" | "offline";

export default function OfflinePage() {
  const router = useRouter();
  const [status, setStatus] = useState<ConnectionStatus>("idle");

  const checking = status === "checking";

  async function handleRetry(): Promise<void> {
    if (checking) return;
    setStatus("checking");

    try {
      // O cabeçalho faz o service worker repassar direto para a rede, evitando
      // que o próprio cache do shell responda e mascare a falta de conexão.
      await fetch("/", {
        cache: "no-store",
        headers: { "x-sw-network-only": "1" },
      });
    } catch {
      setStatus("offline");
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-canvas p-6 text-foreground">
      <section className="w-full max-w-md space-y-6 rounded-2xl border border-border bg-surface-raised p-8 text-center shadow-xl">
        <header className="space-y-2">
          <h1 className="text-2xl font-bold">Você está offline</h1>
          <p className="text-sm text-foreground-muted">
            Não foi possível conectar. Verifique sua internet e tente novamente.
          </p>
        </header>

        <div
          aria-live="polite"
          className="min-h-5 text-sm font-medium text-amber-300"
        >
          {checking
            ? "Verificando conexão…"
            : status === "offline"
              ? "Sem conexão. Verifique o Wi-Fi."
              : ""}
        </div>

        <button
          type="button"
          onClick={handleRetry}
          aria-disabled={checking}
          aria-busy={checking}
          className="rounded-lg bg-emerald-600 px-6 py-3 text-lg font-semibold text-white transition hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas aria-disabled:cursor-not-allowed aria-disabled:opacity-60"
        >
          {checking ? "Verificando conexão…" : "Tentar novamente"}
        </button>
      </section>
    </main>
  );
}
