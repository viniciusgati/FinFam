"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { monthLabel, shiftMonthKey } from "@/lib/finance";

interface MonthSelectorProps {
  monthKey: string;
  isCurrentMonth: boolean;
  /** Rota base da navegação; padrão `/historico` (dashboard usa `/`). */
  basePath?: string;
  /**
   * Intervalo da janela exibida (ex.: `15/09 a 14/10`), mostrado abaixo do
   * rótulo do mês para explicitar a moldura do ciclo.
   */
  rangeLabel?: string;
  /**
   * Quantos meses somar à chave de navegação (`?mes`) para obter o mês
   * exibido. No dashboard por ciclo, a chave é o mês de início e o ciclo é
   * exibido pelo mês da **fatura** (início + 1): `?mes=2026-10` aparece como
   * "novembro de 2026".
   */
  queryMonthShift?: number;
}

export interface MonthSelectorViewProps {
  monthKey: string;
  isCurrentMonth: boolean;
  isPending: boolean;
  rangeLabel?: string;
  onPrevious: () => void;
  onNext: () => void;
  onSelectMonth: (monthKey: string) => void;
}

const buttonClass =
  "rounded-lg border border-border-strong bg-surface-raised px-3 py-2 text-sm font-medium text-foreground-muted transition hover:bg-surface-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-surface-raised";

/**
 * Apresentação pura do seletor de mês (sem hooks/roteador), para o teste rodar
 * com `renderToStaticMarkup`. Os controles ficam desabilitados em `isPending` e
 * o rótulo mostra sempre o mês **selecionado**.
 */
export function MonthSelectorView({
  monthKey,
  isCurrentMonth,
  isPending,
  rangeLabel,
  onPrevious,
  onNext,
  onSelectMonth,
}: MonthSelectorViewProps) {
  const previous = shiftMonthKey(monthKey, -1);
  const next = shiftMonthKey(monthKey, 1);

  return (
    <div className="flex flex-wrap items-center justify-center gap-3">
      <button
        type="button"
        disabled={isPending}
        onClick={onPrevious}
        aria-label={`Mês anterior: ${monthLabel(previous)}`}
        className={buttonClass}
      >
        <span aria-hidden="true">←</span> Mês anterior
      </button>

      <div className="min-w-[10rem] text-center">
        <p
          aria-live="polite"
          className="text-lg font-semibold text-foreground"
        >
          {monthLabel(monthKey)}
        </p>
        {rangeLabel && (
          <p className="text-xs font-medium text-subtle">{rangeLabel}</p>
        )}
      </div>

      <input
        type="month"
        value={monthKey}
        disabled={isPending}
        onChange={(event) => onSelectMonth(event.target.value)}
        aria-label="Selecionar mês"
        className="rounded-lg border border-border-strong bg-surface-raised px-3 py-2 text-sm font-medium text-foreground-muted transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
      />

      <button
        type="button"
        disabled={isPending || isCurrentMonth}
        onClick={onNext}
        aria-label={`Próximo mês: ${monthLabel(next)}`}
        className={buttonClass}
      >
        Próximo mês <span aria-hidden="true">→</span>
      </button>
    </div>
  );
}

export default function MonthSelector({
  monthKey,
  isCurrentMonth,
  basePath = "/historico",
  rangeLabel,
  queryMonthShift = 0,
}: MonthSelectorProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  // A navegação continua em `?mes` (chave do banco); o que o usuário vê é o
  // mês exibido, que no dashboard por ciclo é o mês da fatura (chave + 1).
  const displayMonth = shiftMonthKey(monthKey, queryMonthShift);
  const toQueryMonth = (display: string) =>
    shiftMonthKey(display, -queryMonthShift);

  function navigate(targetDisplay: string) {
    if (!targetDisplay) return;
    const query = toQueryMonth(targetDisplay);
    if (!query || query === monthKey) return;
    startTransition(() => {
      router.push(`${basePath}?mes=${query}`);
    });
  }

  return (
    <MonthSelectorView
      monthKey={displayMonth}
      isCurrentMonth={isCurrentMonth}
      isPending={isPending}
      rangeLabel={rangeLabel}
      onPrevious={() => navigate(shiftMonthKey(displayMonth, -1))}
      onNext={() => navigate(shiftMonthKey(displayMonth, 1))}
      onSelectMonth={navigate}
    />
  );
}
