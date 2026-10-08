import { describe, expect, it } from "vitest";
import { buildDailySeries } from "./dashboard-series";

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
