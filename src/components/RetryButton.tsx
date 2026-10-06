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
      className="rounded-full bg-black/20 px-5 py-2 text-sm font-medium transition hover:bg-black/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2 disabled:opacity-60"
    >
      {isPending ? "Tentando..." : "Tentar novamente"}
    </button>
  );
}
