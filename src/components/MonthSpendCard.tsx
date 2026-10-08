import {
  levelLabel,
  projectionLabel,
  projectionRiskLabel,
  textColorForBackground,
  type FinanceLevel,
} from "@/lib/finance";

export interface MonthSpendCardProps {
  backgroundColor: string;
  percent: number;
  level: FinanceLevel;
  invoiceDue: string;
  /** Contador já formatado (ex.: `8 dias para o fim do ciclo`). */
  countdownLabel: string;
  feedback: string;
  actionableMessage?: string | null;
  projectedPercent?: number;
  projectedRisk?: boolean;
  className?: string;
}

export default function MonthSpendCard({
  backgroundColor,
  percent,
  level,
  invoiceDue,
  countdownLabel,
  feedback,
  actionableMessage,
  projectedPercent,
  projectedRisk = false,
  className = "",
}: MonthSpendCardProps) {
  return (
    <section
      className={`flex flex-col items-center justify-center gap-4 rounded-2xl p-6 text-center transition-colors duration-700 ${className}`.trim()}
      style={{
        backgroundColor,
        color: textColorForBackground(backgroundColor),
      }}
    >
      <header className="space-y-1">
        <p className="text-sm font-medium uppercase tracking-widest opacity-80">
          FinFam
        </p>
        <h1 className="text-xl font-semibold opacity-90">
          Renda do mês consumida
        </h1>
      </header>

      <p className="text-5xl font-black tabular-nums sm:text-7xl">
        {percent}
        <span className="text-2xl align-top sm:text-4xl">%</span>
      </p>

      {projectedPercent !== undefined && (
        <p className="text-sm font-medium opacity-80">
          {projectionLabel(projectedPercent)}
        </p>
      )}

      {projectedPercent !== undefined && projectedRisk && (
        <p
          role="status"
          aria-live="polite"
          className="text-base font-semibold uppercase tracking-wide"
        >
          {projectionRiskLabel(projectedPercent)}
        </p>
      )}

      {actionableMessage && (
        <p
          role="status"
          aria-live="polite"
          className="max-w-xl rounded-xl bg-black/10 px-4 py-3 text-base font-medium"
        >
          {actionableMessage}
        </p>
      )}

      <p className="text-sm font-medium uppercase tracking-wide opacity-80">
        Mês calendário
      </p>

      <p className="text-lg font-semibold">{levelLabel(level)}</p>

      <p className="text-sm font-medium uppercase tracking-wide opacity-80">
        {invoiceDue}
      </p>

      <p className="text-lg font-medium opacity-95">
        {countdownLabel}
      </p>

      <p
        role="status"
        aria-live="polite"
        className="max-w-xl rounded-full px-6 py-3 text-lg"
      >
        {feedback}
      </p>
    </section>
  );
}
