"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

export default function RetryButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => startTransition(() => router.refresh())}
      className="rounded-full border border-border-strong bg-surface-raised px-5 py-2 text-sm font-medium text-foreground transition hover:bg-surface-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 disabled:opacity-60"
    >
      {isPending ? "Tentando..." : "Tentar novamente"}
    </button>
  );
}
