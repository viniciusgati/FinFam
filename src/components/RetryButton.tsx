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
      className="rounded-full bg-black/20 px-5 py-2 text-sm font-medium transition hover:bg-black/30 disabled:opacity-60"
    >
      {isPending ? "Tentando..." : "Tentar novamente"}
    </button>
  );
}
