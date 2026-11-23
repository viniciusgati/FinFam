import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  savingsGoalHistory,
  savingsGoalProgress,
  type SavingsGoalHistory,
} from "@/lib/savings-goal";
import SavingsGoalCard from "./SavingsGoalCard";

function render(
  goalCents: number,
  savedCents: number,
  remainingDays: number,
  history: SavingsGoalHistory | null = null,
): string {
  const progress = savingsGoalProgress({
    goalCents,
    savedCents,
    remainingDays,
  });
  if (progress === null) throw new Error("progresso inesperadamente nulo");
  return renderToStaticMarkup(
    createElement(SavingsGoalCard, { progress, history }),
  ).replace(/\u00a0/g, " ");
}

describe("SavingsGoalCard (renderização)", () => {
  it("mostra meta, guardado estimado, restante e valor por dia", () => {
    const html = render(100000, 25000, 10);

    expect(html).toContain("Meta de economia");
    expect(html).toContain("Meta");
    expect(html).toContain("R$ 1.000,00");
    expect(html).toContain("Guardado estimado");
    expect(html).toContain("R$ 250,00");
    expect(html).toContain("Restante");
    expect(html).toContain("R$ 750,00");
    expect(html).toContain("Por dia restante");
    expect(html).toContain("R$ 75,00");
    expect(html).toContain("25% da meta guardado no ciclo");
    expect(html).not.toContain("Meta atingida!");
  });

  it("anuncia Meta atingida! quando o guardado alcança a meta", () => {
    const html = render(100000, 100000, 10);

    expect(html).toContain("Meta atingida!");
    expect(html).toContain("R$ 0,00");
    expect(html).toContain('aria-valuenow="100"');
  });

  it("com zero dias restantes mostra o restante integral por dia", () => {
    const html = render(100000, 25000, 0);

    expect(html).toContain("R$ 750,00");
    expect(html).not.toContain("Infinity");
    expect(html).not.toContain("NaN");
  });

  it("mostra o histórico dos meses fechados quando informado", () => {
    const history = savingsGoalHistory(
      [
        { monthKey: "2026-01", incomeCents: 200000, consumedCents: 50000 },
        { monthKey: "2026-02", incomeCents: 200000, consumedCents: 190000 },
      ],
      100000,
    );

    const html = render(100000, 25000, 10, history);

    expect(html).toContain(
      "Meta atingida em 1 de 2 meses fechados nos últimos 12 meses.",
    );
  });

  it("sem histórico não renderiza a seção de meses fechados", () => {
    const html = render(100000, 25000, 10);

    expect(html).not.toContain("meses fechados");
  });
});
