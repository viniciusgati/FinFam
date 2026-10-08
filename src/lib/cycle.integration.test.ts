import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  disconnectTestDatabase,
  getTestPrisma,
  requireTestDatabase,
  resetDatabase,
} from "../test/integration";
import DailyAllowanceCard from "../components/DailyAllowanceCard";
import { dailyAllowanceCard, usualDailySpendCents } from "./cycle";
import { loadCycleAllowance, loadDashboardData } from "./dashboard";
import { updateSettings } from "./settings";

// Falha de forma explícita sem `TEST_DATABASE_URL`; nunca toca SQLite.
requireTestDatabase();

const prisma = getTestPrisma();

// 2026-03-25 12:00 em America/Sao_Paulo (UTC-3).
const NOW = new Date("2026-03-25T15:00:00.000Z");

describe("loadCycleAllowance — integração com PostgreSQL", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  it("agrega renda/obrigações pelo cycleKey e gastos avulsos na janela [dia 20, hoje]", async () => {
    await updateSettings({ cycleStartDay: 20 });


    await prisma.income.create({
      data: { name: "Salário", amountCents: 850000 },
    });
    await prisma.fixedExpense.create({
      data: { name: "Aluguel", amountCents: 250000 },
    });

    await prisma.variableExpense.createMany({
      data: [
        // Antes do ciclo (dia 19): fora.
        { description: "Antes", amountCents: 99999, date: new Date("2026-03-19T12:00:00.000Z"), paymentMethod: "PIX" },
        // No início do ciclo (dia 20): conta.
        { description: "Início", amountCents: 10000, date: new Date("2026-03-20T12:00:00.000Z"), paymentMethod: "PIX" },
        // Hoje: conta.
        { description: "Hoje", amountCents: 5000, date: new Date("2026-03-25T12:00:00.000Z"), paymentMethod: "DEBIT" },
        // Amanhã: fora (limite superior é hoje).
        { description: "Amanhã", amountCents: 6000, date: new Date("2026-03-26T12:00:00.000Z"), paymentMethod: "PIX" },
        // Futuro ainda no ciclo: fora.
        { description: "Futuro", amountCents: 7000, date: new Date("2026-03-30T12:00:00.000Z"), paymentMethod: "PIX" },
        // Crédito: não entra no orçamento.
        { description: "Crédito", amountCents: 8000, date: new Date("2026-03-25T13:00:00.000Z"), paymentMethod: "CREDIT" },
      ],
    });

    const allowance = await loadCycleAllowance(NOW);

    expect(allowance.window.cycleKey).toBe("2026-03");
    expect(allowance.freeBudgetCents).toBe(585000);
    expect(allowance.remainingDays).toBe(26);
    expect(allowance.dailyCents).toBe(22500);
    expect(allowance.hasData).toBe(true);

    // Renderização com dados reais: R$ 225,00/dia e 26 dias restantes.
    const html = renderToStaticMarkup(
      createElement(DailyAllowanceCard, {
        card: dailyAllowanceCard(allowance),
      }),
    ).replace(/\u00a0/g, " ");
    expect(html).toContain("R$ 225,00 por dia");
    expect(html).toContain("26 dias restantes no ciclo");
  });

  it("soma entradas avulsas da janela do ciclo e ignora as de fora", async () => {
    await updateSettings({ cycleStartDay: 20 });

    await prisma.variableIncome.createMany({
      data: [
        // Antes do ciclo (dia 19): fora.
        { description: "Antes", amountCents: 99999, date: new Date("2026-03-19T12:00:00.000Z") },
        // Início do ciclo (dia 21): conta.
        { description: "Venda", amountCents: 30000, date: new Date("2026-03-21T12:00:00.000Z") },
        // Amanhã (dia 26): fora do limite superior.
        { description: "Amanhã", amountCents: 5000, date: new Date("2026-03-26T12:00:00.000Z") },
      ],
    });

    const allowance = await loadCycleAllowance(NOW);

    expect(allowance.freeBudgetCents).toBe(30000);
    expect(allowance.hasData).toBe(true);
  });

  it("mostra diária negativa quando o orçamento do ciclo estoura", async () => {
    await updateSettings({ cycleStartDay: 20 });

    await prisma.income.create({
      data: { name: "Salário", amountCents: 100000 },
    });
    await prisma.variableExpense.create({
      data: {
        description: "Estouro",
        amountCents: 126000,
        date: new Date("2026-03-21T12:00:00.000Z"),
        paymentMethod: "PIX",
      },
    });

    const allowance = await loadCycleAllowance(NOW);

    // 100000 - 126000 = -26000 em 26 dias → -1000/dia.
    expect(allowance.freeBudgetCents).toBe(0);
    expect(allowance.dailyCents).toBe(-1000);

    const html = renderToStaticMarkup(
      createElement(DailyAllowanceCard, {
        card: dailyAllowanceCard(allowance),
      }),
    ).replace(/\u00a0/g, " ");
    expect(html).toContain("-R$ 10,00 por dia");
    expect(html).toContain("Orçamento do ciclo estourado");
  });

  it("cycleStartDay = 1 considera o dia 19 (mês calendário)", async () => {
    await updateSettings({ cycleStartDay: 1 });


    await prisma.income.create({
      data: { name: "Salário", amountCents: 20000 },
    });

    await prisma.variableExpense.createMany({
      data: [
        { description: "Dia 19", amountCents: 10000, date: new Date("2026-03-19T12:00:00.000Z"), paymentMethod: "PIX" },
        { description: "Dia 25", amountCents: 5000, date: new Date("2026-03-25T12:00:00.000Z"), paymentMethod: "PIX" },
      ],
    });

    const allowance = await loadCycleAllowance(NOW);

    expect(allowance.window.cycleKey).toBe("2026-03");
    // Ambos os gastos contam: 20000 - 15000 = 5000.
    expect(allowance.freeBudgetCents).toBe(5000);
    expect(allowance.hasData).toBe(true);
  });

  it("sem renda nem obrigações marca hasData = false", async () => {
    await updateSettings({ cycleStartDay: 1 });

    const allowance = await loadCycleAllowance(NOW);

    expect(allowance.hasData).toBe(false);
    expect(allowance.dailyCents).toBe(0);
  });

  it("ritmo recente inclui a fatura do mês além dos avulsos", async () => {
    // Regressão do sintoma "Seu ritmo recente é de R$ 10,42 por dia": numa
    // família que consome pelo cartão, o ritmo precisa incluir a fatura.
    await updateSettings({ cycleStartDay: 1 });

    await prisma.income.create({
      data: { name: "Salário", amountCents: 1200000 },
    });
    const card = await prisma.creditCard.create({
      data: { name: "Nubank", closingDay: 20, dueDay: 5 },
    });
    // Compra em 10/02 com fechamento 20 e vencimento 5 → fatura de março.
    await prisma.cardPurchase.create({
      data: {
        cardId: card.id,
        description: "Mercado",
        amountCents: 600000,
        purchaseDate: new Date("2026-02-10T12:00:00.000Z"),
      },
    });
    await prisma.variableExpense.create({
      data: {
        description: "PIX",
        amountCents: 24000,
        date: new Date("2026-03-05T12:00:00.000Z"),
        paymentMethod: "PIX",
      },
    });

    const allowance = await loadCycleAllowance(NOW);
    const data = await loadDashboardData(NOW);

    expect(data.cardExpensesCents).toBe(600000);
    expect(allowance.variableSpentCents).toBe(24000);
    expect(allowance.elapsedDays).toBe(25);

    // (24.000 + 600.000) / 25 dias = R$ 249,60/dia, não R$ 9,60/dia.
    expect(
      usualDailySpendCents({
        variableSpentCents: allowance.variableSpentCents,
        cardExpensesCents: data.cardExpensesCents,
        elapsedDays: allowance.elapsedDays,
      }),
    ).toBe(24960);
  });
});
