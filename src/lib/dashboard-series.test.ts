import { describe, expect, it } from "vitest";
import {
  buildConsumptionSummary,
  buildDailySeries,
  consumptionAverageLabel,
} from "./dashboard-series";

// Datas ao meio-dia UTC para que o dia no fuso America/Sao_Paulo seja o mesmo
// (ver time.ts); evita off-by-one nas asserções.
const NOW = new Date(Date.UTC(2026, 9, 15, 12)); // 15/10/2026
const OCTOBER = new Date(Date.UTC(2026, 9, 1, 12)); // outubro/2026

describe("buildDailySeries — distribuição por dia", () => {
  it("coloca avulso no dia e fixa no vencimento, com acumulado correto", () => {
    const series = buildDailySeries({
      referenceDate: OCTOBER,
      now: NOW,
      variableExpenses: [
        { amountCents: 5000, date: new Date(Date.UTC(2026, 9, 5, 12)), paymentMethod: "PIX" },
      ],
      fixedExpenses: [{ amountCents: 10000, dueDay: 10 }],
    });

    expect(series.daysInMonth).toBe(31);
    expect(series.dailyExpensesCents[4]).toBe(5000);
    expect(series.dailyExpensesCents[9]).toBe(10000);
    expect(series.cumulativeExpensesCents[9]).toBe(15000);
    expect(series.totalExpensesCents).toBe(15000);
  });

  it("ignora avulsos CREDIT e mantém sum(daily) === total", () => {
    const series = buildDailySeries({
      referenceDate: OCTOBER,
      now: NOW,
      variableExpenses: [
        { amountCents: 5000, date: new Date(Date.UTC(2026, 9, 5, 12)), paymentMethod: "CREDIT" },
        { amountCents: 1200, date: new Date(Date.UTC(2026, 9, 5, 12)), paymentMethod: "CASH" },
      ],
    });

    const sum = series.dailyExpensesCents.reduce((a, b) => a + b, 0);
    expect(sum).toBe(series.totalExpensesCents);
    expect(series.totalExpensesCents).toBe(1200);
    expect(series.dailyExpensesCents[4]).toBe(1200);
  });

  it("ignora avulso de outro mês", () => {
    const series = buildDailySeries({
      referenceDate: OCTOBER,
      now: NOW,
      variableExpenses: [
        { amountCents: 9999, date: new Date(Date.UTC(2026, 8, 30, 12)), paymentMethod: "PIX" },
      ],
    });

    expect(series.totalExpensesCents).toBe(0);
  });

  it("soma faturas no dueDay informado", () => {
    const series = buildDailySeries({
      referenceDate: OCTOBER,
      now: NOW,
      cardInvoiceLines: [{ amountCents: 7000, dueDay: 31 }],
    });

    expect(series.dailyExpensesCents[30]).toBe(7000);
  });
});

describe("buildDailySeries — consumo variável e obrigações", () => {
  it("separa avulsos (consumo) das fixas (obrigação) no dia", () => {
    const series = buildDailySeries({
      referenceDate: OCTOBER,
      now: NOW,
      fixedExpenses: [{ amountCents: 10000, dueDay: 10 }],
      variableExpenses: [
        { amountCents: 5000, date: new Date(Date.UTC(2026, 9, 5, 12)), paymentMethod: "PIX" },
      ],
    });

    expect(series.variableDailyCents[4]).toBe(5000); // dia 5
    expect(series.variableDailyCents[9]).toBe(0);
    expect(series.obligationDailyCents[9]).toBe(10000); // dia 10
    // `dailyExpensesCents` continua somando tudo (invariante do total).
    expect(series.dailyExpensesCents[4]).toBe(5000);
    expect(series.dailyExpensesCents[9]).toBe(10000);
  });

  it("compra do próprio mês vira consumo na data da compra", () => {
    const series = buildDailySeries({
      referenceDate: OCTOBER,
      now: NOW,
      cardInvoiceLines: [{ amountCents: 7000, dueDay: 5, purchaseDay: 12 }],
    });

    expect(series.variableDailyCents[11]).toBe(7000); // dia 12
    expect(series.obligationDailyCents[4]).toBe(0);
    // A fatura segue no vencimento para a invariante do total.
    expect(series.dailyExpensesCents[4]).toBe(7000);
  });

  it("parcela de compra anterior vira obrigação no vencimento", () => {
    const series = buildDailySeries({
      referenceDate: OCTOBER,
      now: NOW,
      cardInvoiceLines: [
        { amountCents: 7000, dueDay: 5, purchaseDay: null },
        { amountCents: 1000, dueDay: 6 },
      ],
    });

    expect(series.variableDailyCents[4]).toBe(0);
    expect(series.variableDailyCents[5]).toBe(0);
    expect(series.obligationDailyCents[4]).toBe(7000);
    expect(series.obligationDailyCents[5]).toBe(1000);
  });
});

describe("buildDailySeries — calendário", () => {
  it("mês corrente encerra o acumulado em elapsedDay (dia de hoje)", () => {
    const series = buildDailySeries({
      referenceDate: OCTOBER,
      now: NOW,
      fixedExpenses: [{ amountCents: 1000, dueDay: 10 }],
    });

    expect(series.elapsedDay).toBe(15);
    expect(series.cumulativeExpensesCents).toHaveLength(15);
  });

  it("mês passado cobre o mês inteiro", () => {
    const series = buildDailySeries({
      referenceDate: new Date(Date.UTC(2026, 8, 1, 12)), // setembro/2026
      now: NOW,
    });

    expect(series.elapsedDay).toBe(30);
    expect(series.cumulativeExpensesCents).toHaveLength(30);
  });

  it("mês futuro tem elapsedDay 0 e projeção finita", () => {
    const series = buildDailySeries({
      referenceDate: new Date(Date.UTC(2026, 10, 1, 12)), // novembro/2026
      now: NOW,
    });

    expect(series.elapsedDay).toBe(0);
    expect(Number.isFinite(series.projectedMonthEndCents)).toBe(true);
    expect(series.projectedMonthEndCents).toBe(0);
  });

  it("calcula o orçamento diário a partir da renda", () => {
    const series = buildDailySeries({
      referenceDate: OCTOBER,
      now: NOW,
      incomeCents: 310000,
      variableExpenses: [
        { amountCents: 4000, date: new Date(Date.UTC(2026, 9, 15, 12)), paymentMethod: "PIX" },
      ],
    });

    expect(series.entriesCents).toBe(310000);
    expect(series.dailyBudgetCents).toBe(10000);
    expect(series.projectedMonthEndCents).toBe(Math.round((4000 / 15) * 31));
  });
});

describe("buildConsumptionSummary", () => {
  const base = {
    incomeCents: 500000,
    fixedExpensesCents: 300000,
    daysInMonth: 31,
    daysElapsed: 15,
    cycleDays: 31,
  };

  it("expõe o consumo disponível e as três janelas de média", () => {
    const summary = buildConsumptionSummary(base);

    expect(summary.availableCents).toBe(200000);
    expect(summary.overCommitted).toBe(false);
    expect(summary.dailyByMonthCents).toBe(6452);
    expect(summary.dailyByElapsedCents).toBe(13333);
    expect(summary.dailyByCycleCents).toBe(6452);
    expect(summary.daysInMonth).toBe(31);
    expect(summary.daysElapsed).toBe(15);
    expect(summary.cycleDays).toBe(31);
  });

  it("deixa a janela do ciclo nula quando cycleDays não é informado", () => {
    const { cycleDays, ...withoutCycle } = base;
    void cycleDays;
    const summary = buildConsumptionSummary(withoutCycle);

    expect(summary.cycleDays).toBeNull();
    expect(summary.dailyByCycleCents).toBeNull();
    expect(summary.availableCents).toBe(200000);
    expect(summary.dailyByMonthCents).toBe(6452);
    expect(summary.dailyByElapsedCents).toBe(13333);
  });

  it("marca overCommitted e zera tudo quando as fixas cobrem a renda", () => {
    for (const incomeCents of [300000, 0, -100]) {
      const summary = buildConsumptionSummary({
        incomeCents,
        fixedExpensesCents: 300000,
        daysInMonth: 31,
        daysElapsed: 15,
        cycleDays: 31,
      });

      expect(summary.availableCents).toBe(0);
      expect(summary.overCommitted).toBe(true);
      expect(summary.dailyByMonthCents).toBe(0);
      expect(summary.dailyByElapsedCents).toBe(0);
      expect(summary.dailyByCycleCents).toBe(0);
      expect(Number.isNaN(summary.dailyByMonthCents)).toBe(false);
      expect(summary.availableCents).not.toBeLessThan(0);
    }
  });
});

describe("consumptionAverageLabel", () => {
  const normal = buildConsumptionSummary({
    incomeCents: 500000,
    fixedExpensesCents: 300000,
    daysInMonth: 31,
    daysElapsed: 15,
    cycleDays: 31,
  });

  it("rotula o consumo e a média diária do mês", () => {
    const label = consumptionAverageLabel(normal).replace(/\u00a0/g, " ");

    expect(label).toBe(
      "Consumo de R$ 2.000,00 · R$ 64,52/dia (mês) · não inclui contas fixas",
    );
    expect(label).toContain("não inclui contas fixas");
  });

  it("não exibe R$ quando as fixas consomem toda a renda", () => {
    const committed = buildConsumptionSummary({
      incomeCents: 300000,
      fixedExpensesCents: 300000,
      daysInMonth: 31,
      daysElapsed: 15,
      cycleDays: 31,
    });
    const label = consumptionAverageLabel(committed);

    expect(label).toBe(
      "Sem consumo disponível: as contas fixas consomem toda a renda do mês.",
    );
    expect(label).not.toContain("R$");
  });
});
