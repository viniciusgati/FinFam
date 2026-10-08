import {
  levelLabel,
  projectionLabel,
  projectionRiskLabel,
  textColorForBackground,
  type FinanceLevel,
} from "@/lib/finance";
import { buildMonthSpendStats } from "@/lib/month-spend";

export interface MonthSpendCardProps {
  backgroundColor: string;
  percent: number;
  level: FinanceLevel;
  invoiceDue: string;
  /** Contador já formatado (ex.: `8 dias para o fim do ciclo`). */
  countdownLabel: string;
  /** Subtítulo do consumo disponível (`entradas − gastos fixos`) e média diária. */
  consumptionLabel?: string | null;
  feedback: string;
  actionableMessage?: string | null;
  projectedPercent?: number;
  projectedRisk?: boolean;
  /** Renda do mês em centavos (mesma base do `%`). */
  incomeCents: number;
  /** Consumo do mês em centavos (fixas + fatura + avulsos). */
  consumedCents: number;
  /** Projeção de fechamento do mês em centavos. */
  projectedCents: number;
  className?: string;
}

/**
 * Card principal do dashboard. O `%` fica à esquerda com a barra de progresso
 * (mês calendário) e, à direita, os valores em R$ que explicam o número: renda,
 * consumido, disponível e projeção de fechamento. Os rótulos do dinheiro vêm de
 * `buildMonthSpendStats` (função pura testada em month-spend.test.ts).
 */
export default function MonthSpendCard({
  backgroundColor,
  percent,
  level,
  invoiceDue,
  countdownLabel,
  consumptionLabel,
  feedback,
  actionableMessage,
  projectedPercent,
  projectedRisk = false,
  incomeCents,
  consumedCents,
  projectedCents,
  className = "",
}: MonthSpendCardProps) {
  const stats = buildMonthSpendStats({
    incomeCents,
    consumedCents,
    projectedCents,
    consumedPercent: percent,
  });
  const barPercent = Math.min(Math.max(percent, 0), 100);

  return (
    <section
      className={`rounded-2xl p-6 transition-colors duration-700 sm:p-8 ${className}`.trim()}
      style={{
        backgroundColor,
        color: textColorForBackground(backgroundColor),
      }}
    >
      <div className="flex flex-col gap-6 lg:gap-8">
        <header className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
          <div className="space-y-1">
            <p className="text-sm font-medium uppercase tracking-widest opacity-80">
              FinFam
            </p>
            <h1 className="text-xl font-semibold opacity-90 sm:text-2xl">
              Renda do mês consumida
            </h1>
          </div>

          <p className="rounded-full bg-black/10 px-4 py-1.5 text-base font-semibold">
            {levelLabel(level)}
          </p>
        </header>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-center lg:gap-10">
          <div className="flex flex-col gap-3 text-center lg:text-left">
            <p className="text-xs font-medium uppercase tracking-widest opacity-80">
              Mês calendário
            </p>

            <p className="text-5xl font-black tabular-nums sm:text-7xl">
              {percent}
              <span className="align-top text-2xl sm:text-4xl">%</span>
            </p>

            <div
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={barPercent}
              aria-valuetext={`${percent}% da renda consumida`}
              className="h-3 w-full overflow-hidden rounded-full bg-current/20"
            >
              <div
                className="h-full rounded-full bg-current/70"
                style={{ width: `${barPercent}%` }}
              />
            </div>

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
          </div>

          <dl className="grid grid-cols-2 gap-3 sm:gap-4 lg:gap-3">
            {stats.map((stat) => (
              <div
                key={stat.key}
                className="rounded-xl bg-black/10 px-4 py-3 text-left"
              >
                <dt className="text-xs font-medium uppercase tracking-wide opacity-80">
                  {stat.label}
                </dt>
                <dd className="text-xl font-bold tabular-nums sm:text-2xl">
                  {stat.value}
                </dd>
                {stat.detail !== null && (
                  <p className="text-xs font-medium opacity-80">{stat.detail}</p>
                )}
              </div>
            ))}
          </dl>
        </div>

        {actionableMessage && (
          <p
            role="status"
            aria-live="polite"
            className="rounded-xl bg-black/10 px-4 py-3 text-base font-medium"
          >
            {actionableMessage}
          </p>
        )}

        <footer className="flex flex-col gap-2 border-t border-current/20 pt-4 text-sm">
          <p className="flex flex-wrap items-center gap-x-4 gap-y-1 font-medium opacity-90">
            <span className="uppercase tracking-wide">{invoiceDue}</span>
            <span>{countdownLabel}</span>
            {consumptionLabel && <span>{consumptionLabel}</span>}
          </p>

          <p role="status" aria-live="polite" className="font-medium opacity-90">
            {feedback}
          </p>
        </footer>
      </div>
    </section>
  );
}
