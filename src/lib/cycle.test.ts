import { describe, expect, it } from "vitest";
import {
  cycleWindow,
  dailyAllowanceCents,
  dailyAllowanceCard,
  dailyCentsForBudget,
  remainingCycleDays,
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

describe("dailyCentsForBudget", () => {
  it("arredonda a divisão para centavos", () => {
    expect(dailyCentsForBudget(325000, 26)).toBe(12500);
  });

  it("orçamento livre <= 0 retorna 0 (nunca negativo)", () => {
    expect(dailyCentsForBudget(-500, 10)).toBe(0);
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
    expect(allowance.dailyCents).toBe(12500);
    expect(allowance.hasData).toBe(true);
  });

  it("orçamento livre <= 0 retorna diária 0", () => {
    const allowance = dailyAllowanceCents({
      incomeCents: 100000,
      obligationsCents: 100000,
      variableSpentCents: 1,
      cycleStartDay: 1,
      now: NOW,
    });

    expect(allowance.freeBudgetCents).toBe(0);
    expect(allowance.dailyCents).toBe(0);
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
});

describe("dailyAllowanceCard", () => {
  function allowance(overrides: Partial<DailyAllowance>): DailyAllowance {
    return {
      dailyCents: 0,
      freeBudgetCents: 0,
      remainingDays: 10,
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
});
