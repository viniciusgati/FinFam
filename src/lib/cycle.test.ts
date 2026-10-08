import { describe, expect, it } from "vitest";
import {
  cycleEndCountdownLabel,
  cycleWindow,
  dailyAllowanceCents,
  dailyAllowanceCard,
  dailyCentsForBudget,
  elapsedCycleDays,
  remainingCycleDays,
  usualDailySpendCents,
  type DailyAllowance,
} from "./cycle";

// Data de referência: 2026-03-25 12:00 em America/Sao_Paulo (UTC-3).
const NOW = new Date("2026-03-25T15:00:00.000Z");

describe("cycleWindow", () => {
  it("cycleStartDay = 1 usa o mês calendário", () => {
    const window = cycleWindow(NOW, 1);
    expect(window.cycleKey).toBe("2026-03");
    expect(window.start.toISOString()).toBe("2026-03-01T03:00:00.000Z");
    expect(window.end.toISOString()).toBe("2026-03-31T03:00:00.000Z");
    expect(window.nextStart.toISOString()).toBe("2026-04-01T03:00:00.000Z");
  });

  it("cycleStartDay = 20 vai do dia 20 ao 19 do mês seguinte", () => {
    const window = cycleWindow(NOW, 20);
    expect(window.cycleKey).toBe("2026-03");
    expect(window.start.toISOString()).toBe("2026-03-20T03:00:00.000Z");
    expect(window.end.toISOString()).toBe("2026-04-19T03:00:00.000Z");
    expect(window.nextStart.toISOString()).toBe("2026-04-20T03:00:00.000Z");
  });

  it("antes do dia de início, o ciclo começou no mês anterior", () => {
    const before = new Date("2026-03-05T15:00:00.000Z");
    const window = cycleWindow(before, 20);
    expect(window.cycleKey).toBe("2026-02");
    expect(window.start.toISOString()).toBe("2026-02-20T03:00:00.000Z");
    expect(window.end.toISOString()).toBe("2026-03-19T03:00:00.000Z");
  });

  it("atravessa a virada do ano", () => {
    const january = new Date("2026-01-05T15:00:00.000Z");
    const window = cycleWindow(january, 20);
    expect(window.cycleKey).toBe("2025-12");
    expect(window.start.toISOString()).toBe("2025-12-20T03:00:00.000Z");
    expect(window.end.toISOString()).toBe("2026-01-19T03:00:00.000Z");
  });
});

describe("remainingCycleDays", () => {
  it("cycleStartDay = 1 e 2026-03-25 → 7 dias (contando hoje)", () => {
    expect(remainingCycleDays(NOW, 1)).toBe(7);
  });

  it("cycleStartDay = 20 e 2026-03-25 → 26 dias", () => {
    expect(remainingCycleDays(NOW, 20)).toBe(26);
  });

  it("no último dia do ciclo retorna 1", () => {
    const lastDay = new Date("2026-03-31T15:00:00.000Z");
    expect(remainingCycleDays(lastDay, 1)).toBe(1);
  });
});

describe("elapsedCycleDays", () => {
  it("cycleStartDay = 20 e 2026-03-25 → 6 dias (contando hoje)", () => {
    expect(elapsedCycleDays(NOW, 20)).toBe(6);
  });

  it("cycleStartDay = 1 e 2026-03-25 → 25 dias", () => {
    expect(elapsedCycleDays(NOW, 1)).toBe(25);
  });

  it("no primeiro dia do ciclo retorna 1", () => {
    const firstDay = new Date("2026-03-20T15:00:00.000Z");
    expect(elapsedCycleDays(firstDay, 20)).toBe(1);
  });
});

describe("usualDailySpendCents", () => {
  it("soma avulsos e fatura do mês e divide pelos dias decorridos", () => {
    expect(
      usualDailySpendCents({
        variableSpentCents: 24000,
        cardExpensesCents: 600000,
        elapsedDays: 25,
      }),
    ).toBe(24960);
  });

  it("sem consumo medido retorna null", () => {
    expect(
      usualDailySpendCents({
        variableSpentCents: 0,
        cardExpensesCents: 0,
        elapsedDays: 10,
      }),
    ).toBeNull();
  });

  it("sem dias decorridos retorna null", () => {
    expect(
      usualDailySpendCents({
        variableSpentCents: 1000,
        cardExpensesCents: 1000,
        elapsedDays: 0,
      }),
    ).toBeNull();
  });

  it("ignora valores negativos", () => {
    expect(
      usualDailySpendCents({
        variableSpentCents: -100,
        cardExpensesCents: 10000,
        elapsedDays: 10,
      }),
    ).toBe(1000);
  });
});

describe("dailyCentsForBudget", () => {
  it("arredonda a divisão para centavos", () => {
    expect(dailyCentsForBudget(325000, 26)).toBe(12500);
  });

  it("orçamento negativo (ciclo estourado) vira diária negativa", () => {
    expect(dailyCentsForBudget(-500, 10)).toBe(-50);
    expect(dailyCentsForBudget(0, 10)).toBe(0);
  });

  it("remainingDays = 0 não divide por zero: devolve o restante disponível", () => {
    expect(dailyCentsForBudget(5000, 0)).toBe(5000);
  });
});

describe("dailyAllowanceCents", () => {
  it("R$ 3.250,00 livres com 26 dias restantes → R$ 125,00/dia", () => {
    const allowance = dailyAllowanceCents({
      incomeCents: 500000,
      obligationsCents: 100000,
      variableSpentCents: 75000,
      cycleStartDay: 20,
      now: NOW,
    });

    expect(allowance.freeBudgetCents).toBe(325000);
    expect(allowance.remainingDays).toBe(26);
    expect(allowance.variableSpentCents).toBe(75000);
    expect(allowance.elapsedDays).toBe(6);
    expect(allowance.dailyCents).toBe(12500);
    expect(allowance.hasData).toBe(true);
  });

  it("ciclo estourado: orçamento livre 0 e diária negativa (excesso/dia)", () => {
    const allowance = dailyAllowanceCents({
      incomeCents: 100000,
      obligationsCents: 100000,
      variableSpentCents: 50000,
      cycleStartDay: 1,
      now: NOW,
    });

    expect(allowance.freeBudgetCents).toBe(0);
    expect(allowance.dailyCents).toBe(-7143);
    expect(allowance.hasData).toBe(true);
  });

  it("sem renda nem obrigações marca hasData = false", () => {
    const allowance = dailyAllowanceCents({
      incomeCents: 0,
      obligationsCents: 0,
      variableSpentCents: 0,
      cycleStartDay: 1,
      now: NOW,
    });

    expect(allowance.hasData).toBe(false);
  });

  it("renda 10.000, obrigações 5.000 e avulso 200 (52% consumido) → diária > 0", () => {
    const allowance = dailyAllowanceCents({
      incomeCents: 1000000,
      obligationsCents: 500000,
      variableSpentCents: 20000,
      cycleStartDay: 1,
      now: NOW,
    });

    expect(allowance.freeBudgetCents).toBe(480000);
    expect(allowance.dailyCents).toBeGreaterThan(0);
  });
});

describe("dailyAllowanceCard", () => {
  function allowance(overrides: Partial<DailyAllowance>): DailyAllowance {
    return {
      dailyCents: 0,
      freeBudgetCents: 0,
      remainingDays: 10,
      variableSpentCents: 0,
      elapsedDays: 0,
      hasData: true,
      window: cycleWindow(NOW, 1),
      ...overrides,
    };
  }

  it("mostra o valor em R$ por dia e os dias restantes", () => {
    const card = dailyAllowanceCard(
      allowance({
        dailyCents: 12500,
        freeBudgetCents: 325000,
        remainingDays: 26,
      }),
    );

    expect(card.state).toBe("ready");
    expect(card.label.replace(/\u00a0/g, " ")).toBe("R$ 125,00 por dia");
    expect(card.detail).toBe("26 dias restantes no ciclo");
  });

  it("expõe a janela do ciclo a partir do dia de início", () => {
    const card = dailyAllowanceCard(
      allowance({ window: cycleWindow(NOW, 20) }),
    );

    expect(card.periodLabel).toBe("Ciclo financeiro · início dia 20");
  });

  it("quando o ciclo coincide com o mês, explica no rótulo do período", () => {
    const card = dailyAllowanceCard(allowance({ window: cycleWindow(NOW, 1) }));

    expect(card.periodLabel).toBe(
      "Ciclo financeiro · início dia 1 (coincide com o mês)",
    );
  });

  it("exibe o saldo restante do ciclo em R$ quando há dados", () => {
    const card = dailyAllowanceCard(
      allowance({
        dailyCents: 12500,
        freeBudgetCents: 325000,
        remainingDays: 26,
        window: cycleWindow(NOW, 20),
      }),
    );

    expect(card.freeBudgetLabel.replace(/\u00a0/g, " ")).toBe(
      "Ainda tem R$ 3.250,00 até o fim do ciclo",
    );
  });

  it("não exibe saldo sem dados nem com orçamento livre zerado", () => {
    const noData = dailyAllowanceCard(allowance({ hasData: false }));
    expect(noData.freeBudgetLabel).toBe("");

    const exhausted = dailyAllowanceCard(
      allowance({ freeBudgetCents: 0, remainingDays: 10 }),
    );
    expect(exhausted.freeBudgetLabel).toBe("");

    const over = dailyAllowanceCard(
      allowance({ dailyCents: -1250, freeBudgetCents: 0, remainingDays: 8 }),
    );
    expect(over.freeBudgetLabel).toBe("");
  });

  it("orçamento esgotado mostra R$ 0,00 por dia", () => {
    const card = dailyAllowanceCard(
      allowance({ freeBudgetCents: 0, remainingDays: 10 }),
    );

    expect(card.state).toBe("exhausted");
    expect(card.label.replace(/\u00a0/g, " ")).toBe("R$ 0,00 por dia");
    expect(card.detail).toBe("Orçamento do ciclo esgotado");
  });

  it("remainingDays = 0 mostra Último dia do ciclo com o restante disponível", () => {
    const card = dailyAllowanceCard(
      allowance({ dailyCents: 5000, freeBudgetCents: 5000, remainingDays: 0 }),
    );

    expect(card.state).toBe("last-day");
    expect(card.label.replace(/\u00a0/g, " ")).toBe("R$ 50,00 por dia");
    expect(card.detail).toBe("Último dia do ciclo");
  });

  it("sem dados do ciclo mostra Sem dados do ciclo", () => {
    const card = dailyAllowanceCard(allowance({ hasData: false }));

    expect(card.state).toBe("no-data");
    expect(card.label).toBe("Sem dados do ciclo");
  });

  it("ciclo estourado mostra a diária negativa", () => {
    const card = dailyAllowanceCard(
      allowance({ dailyCents: -1250, freeBudgetCents: 0, remainingDays: 8 }),
    );

    expect(card.state).toBe("over-budget");
    expect(card.label.replace(/\u00a0/g, " ")).toBe("-R$ 12,50 por dia");
    expect(card.detail).toBe("Orçamento do ciclo estourado");
  });
});

describe("cycleEndCountdownLabel", () => {
  it("dia 08 com o ciclo fechando no dia 15 → 8 dias (contando hoje)", () => {
    expect(cycleEndCountdownLabel(8)).toBe("8 dias para o fim do ciclo");
  });

  it("no último dia do ciclo", () => {
    expect(cycleEndCountdownLabel(1)).toBe("Hoje é o último dia do ciclo");
  });

  it("ciclo encerrado", () => {
    expect(cycleEndCountdownLabel(0)).toBe("Ciclo encerrado");
  });
});
