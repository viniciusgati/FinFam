import type { SpendAdvice } from "@/lib/spend-advice";

export interface SpendAdviceCardProps {
  advice: SpendAdvice;
}

/**
 * Bloco único de recomendação do dashboard: só apresenta o texto e os metadados
 * de severidade de `buildSpendAdvice` (função pura testada em
 * spend-advice.test.ts). A presença/ausência do bloco é decidida pela página.
 */
export default function SpendAdviceCard({ advice }: SpendAdviceCardProps) {
  return (
    <p
      role={advice.role}
      aria-live={advice.ariaLive}
      className={`rounded-2xl px-5 py-4 text-base font-medium ${advice.colorClass}`}
    >
      {advice.message}
    </p>
  );
}
