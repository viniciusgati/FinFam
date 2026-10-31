import { describe, expect, it } from "vitest";
import {
  buildSpendAdvice,
  SPEND_ADVICE_AHEAD_COLOR,
  SPEND_ADVICE_BEHIND_COLOR,
  SPEND_ADVICE_ON_PACE_COLOR,
  SPEND_ADVICE_OVER_BUDGET_COLOR,
  type SpendAdviceInput,
} from "./spend-advice";

function plain(text: string): string {
  return text.replace(/\u00a0/g, " ");
}

function input(overrides: Partial<SpendAdviceInput> = {}): SpendAdviceInput {
  return {
    // Orçamento variável = 300000 − 90000 = 210000 → R$ 7.000/dia em 30 dias.
    windowDays: 30,
    elapsedDays: 10,
    incomeCents: 300000,
    fixedExpensesCents: 90000,
    variableConsumedCents: 70000,
    isCurrentCycle: true,
    ...overrides,
  };
}

describe("buildSpendAdvice — estados", () => {
  it("adiantado: segura o consumo pelos dias de delta (ceil)", () => {
    const advice = buildSpendAdvice(
      input({ variableConsumedCents: 98000 }),
    );

    expect(advice?.state).toBe("ahead");
    expect(plain(advice?.message ?? "")).toBe(
      "Segure o consumo por 4 dias para se manter dentro do necessário.",
    );
    expect(advice?.role).toBe("status");
    expect(advice?.ariaLive).toBe("polite");
    expect(advice?.colorClass).toBe(SPEND_ADVICE_AHEAD_COLOR);
  });

  it("atrasado: dias atrás (floor) e economia projetada até o fim do ciclo", () => {
    const advice = buildSpendAdvice(
      input({ variableConsumedCents: 35000 }),
    );

    expect(advice?.state).toBe("behind");
    expect(plain(advice?.message ?? "")).toBe(
      "Você está 5 dias atrás do consumo esperado. Continue assim para economizar R$ 1.050,00 até o fim do ciclo.",
    );
    expect(advice?.role).toBe("status");
    expect(advice?.ariaLive).toBe("polite");
    expect(advice?.colorClass).toBe(SPEND_ADVICE_BEHIND_COLOR);
  });

  it("delta = 0 fica no ritmo esperado", () => {
    const advice = buildSpendAdvice(input({ variableConsumedCents: 70000 }));

    expect(advice?.state).toBe("on-pace");
    expect(plain(advice?.message ?? "")).toBe(
      "No ritmo esperado: continue assim para fechar o ciclo dentro do orçamento.",
    );
    expect(advice?.role).toBe("status");
    expect(advice?.ariaLive).toBe("polite");
    expect(advice?.colorClass).toBe(SPEND_ADVICE_ON_PACE_COLOR);
  });

  it("estouro tem precedência sobre o ritmo e usa role=alert", () => {
    const advice = buildSpendAdvice(
      input({ variableConsumedCents: 220000 }),
    );

    expect(advice?.state).toBe("over-budget");
    expect(plain(advice?.message ?? "")).toBe(
      "Orçamento variável do ciclo estourado em R$ 100,00. Reduza o consumo pelos 20 dias restantes.",
    );
    expect(advice?.role).toBe("alert");
    expect(advice?.ariaLive).toBe("assertive");
    expect(advice?.colorClass).toBe(SPEND_ADVICE_OVER_BUDGET_COLOR);
  });
});

describe("buildSpendAdvice — limites", () => {
  it("excesso de 1 centavo já é estouro", () => {
    const advice = buildSpendAdvice(
      input({ variableConsumedCents: 210001 }),
    );

    expect(advice?.state).toBe("over-budget");
  });

  it("consumo exatamente no orçamento não é estouro", () => {
    const advice = buildSpendAdvice(
      input({ variableConsumedCents: 210000 }),
    );

    expect(advice?.state).toBe("ahead");
  });

  it("delta negativo por menos de uma diária cai em atrasado (floor = 0)", () => {
    const advice = buildSpendAdvice(
      input({ variableConsumedCents: 69999 }),
    );

    expect(advice?.state).toBe("behind");
    expect(plain(advice?.message ?? "")).toContain("0 dias atrás");
  });

  it("sem orçamento variável (diária 0) não gera alerta", () => {
    expect(
      buildSpendAdvice(
        input({ incomeCents: 90000, fixedExpensesCents: 90000 }),
      ),
    ).toBeNull();
    expect(
      buildSpendAdvice(
        input({ incomeCents: 50000, fixedExpensesCents: 90000 }),
      ),
    ).toBeNull();
  });

  it("fora do ciclo corrente não gera alerta", () => {
    expect(buildSpendAdvice(input({ isCurrentCycle: false }))).toBeNull();
  });

  it("sem dias decorridos ou sem janela não gera alerta", () => {
    expect(buildSpendAdvice(input({ elapsedDays: 0 }))).toBeNull();
    expect(buildSpendAdvice(input({ windowDays: 0 }))).toBeNull();
  });
});
