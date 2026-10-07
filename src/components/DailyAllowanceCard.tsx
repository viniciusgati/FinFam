import type { DailyAllowanceCard as DailyAllowanceCardView } from "@/lib/cycle";

export interface DailyAllowanceCardProps {
  card: DailyAllowanceCardView;
}

/**
 * Card "Pode gastar por dia": diária restante do ciclo em R$ e os dias
 * restantes. O texto é derivado da função pura `dailyAllowanceCard` (testável
 * sem DOM); aqui só há a apresentação.
 */
export default function DailyAllowanceCard({ card }: DailyAllowanceCardProps) {
  return (
    <section
      aria-label={card.ariaLabel}
      className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-surface p-6 text-center shadow-sm"
    >
      <h2 className="text-sm font-medium uppercase tracking-widest text-subtle">
        Pode gastar por dia
      </h2>
      <p className="text-4xl font-black tabular-nums text-foreground">
        {card.label}
      </p>
      {card.detail && (
        <p className="text-lg text-foreground-muted">{card.detail}</p>
      )}
    </section>
  );
}
