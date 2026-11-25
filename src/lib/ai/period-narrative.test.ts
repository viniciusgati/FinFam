import { describe, expect, it } from "vitest";
import {
  buildPeriodAnalysis,
  type PeriodMonth,
  type PeriodTransaction,
} from "../period-analysis";
import {
  buildPeriodAiFactSheet,
  buildPeriodAiPrompt,
  localPeriodAiNarrative,
  parsePeriodAiNarrative,
} from "./period-narrative";

function at(isoDate: string): Date {
  return new Date(`${isoDate}T12:00:00.000Z`);
}

function normalizeMoneyText(value: string): string {
  return value.replace(/\u00a0/g, " ");
}

function closedMonth(monthKey: string): PeriodMonth {
  return {
    monthKey,
    incomeCents: 100000,
    consumedCents: 80000,
    fixedExpensesCents: 50000,
    variableExpensesCents: 30000,
    cardExpensesCents: 0,
    categories: [
      { category: "Alimentação", amountCents: 30000 },
      { category: "Casa", amountCents: 50000 },
    ],
    variableDailyCents: Array.from({ length: 30 }, (_, index) =>
      index === 9 ? 30000 : 0,
    ),
    daysInMonth: 30,
    elapsedDay: 30,
  };
}

function buildFixtureAnalysis() {
  const months = ["2026-01", "2026-02", "2026-03", "2026-04"].map(
    closedMonth,
  );
  const current: PeriodMonth = {
    monthKey: "2026-05",
    incomeCents: 100000,
    consumedCents: 90000,
    fixedExpensesCents: 50000,
    variableExpensesCents: 30000,
    cardExpensesCents: 10000,
    categories: [
      { category: "Alimentação", amountCents: 40000 },
      { category: "Casa", amountCents: 50000 },
    ],
    variableDailyCents: Array.from({ length: 31 }, (_, index) =>
      index === 9 ? 30000 : 0,
    ),
    daysInMonth: 31,
    elapsedDay: 15,
    isCurrent: true,
  };

  const transactionMonths = [...months.map((month) => month.monthKey), "2026-05"];
  const transactions: PeriodTransaction[] = [
    ...transactionMonths.flatMap((monthKey) =>
      (monthKey === "2026-05" ? [1, 5, 10, 15] : [5, 10, 15, 20]).map(
        (day) => ({
          description: "iFood",
          amountCents: 5500,
          date: at(`${monthKey}-${String(day).padStart(2, "0")}`),
          category: "Alimentação",
          source: "variable" as const,
          paymentMethod: "PIX" as const,
        }),
      ),
    ),
    ...transactionMonths.map((monthKey) => ({
      description: "Netflix",
      amountCents: 3990,
      date: at(`${monthKey}-15`),
      category: "Casa",
      source: "card" as const,
      installmentsTotal: 1,
    })),
  ];

  return buildPeriodAnalysis({
    months,
    current,
    transactions,
    fixedExpenses: [
      {
        name: "Aluguel",
        amountCents: 50000,
        dueDay: 10,
        category: "Moradia",
      },
    ],
    incomes: [{ name: "Salário", amountCents: 100000, receiveDay: 5 }],
    cards: [
      {
        id: "card-1",
        name: "Cartão principal",
        closingDay: 20,
        dueDay: 5,
        limitCents: 500000,
      },
    ],
    cardPurchases: [
      {
        description: "Notebook",
        amountCents: 90000,
        purchaseDate: at("2026-05-10"),
        category: "Casa",
        cardId: "card-1",
        card: { closingDay: 20, dueDay: 5 },
        installmentsTotal: 3,
      },
    ],
    referenceMonthKey: "2026-05",
    reserveSnapshots: [
      { monthKey: "2026-01", amountCents: 100000 },
      { monthKey: "2026-05", amountCents: 160000 },
    ],
  });
}

describe("buildPeriodAiFactSheet", () => {
  it("remove nomes e descrições, mas mantém categorias e ids opacos", () => {
    const factSheet = buildPeriodAiFactSheet(buildFixtureAnalysis());
    const serialized = JSON.stringify(factSheet);

    expect(serialized).not.toContain("iFood");
    expect(serialized).not.toContain("Netflix");
    expect(serialized).not.toContain("Notebook");
    expect(serialized).not.toContain("Aluguel");
    expect(serialized).not.toContain("Salário");
    expect(serialized).toContain("Alimentação");
    expect(serialized).toContain("Casa");

    expect(factSheet.factIds).toEqual(
      expect.arrayContaining([
        "period",
        "flow",
        "pace",
        "composition",
        "commitments",
        "data-quality",
        "reserve",
        "category-alimentação",
        "lever-0",
        "anomaly-0",
      ]),
    );
    expect(factSheet.facts.reserve).toMatchObject({
      confirmedCents: 160000,
      coverageMonths: 3.2,
      gapCents: 140000,
      targetMonths: 6,
    });
    expect(factSheet.facts.levers[0]).toMatchObject({
      id: "lever-0",
      kind: "frequency",
      category: "Alimentação",
      monthlySavingsCents: 5500,
    });
    expect(factSheet.facts.levers[0]).not.toHaveProperty("merchantName");
    expect(factSheet.facts.levers[0]).not.toHaveProperty("reason");
    expect(factSheet.facts.anomalies[0]).not.toHaveProperty("detail");
    expect(factSheet.facts.anomalies[0]).not.toHaveProperty("title");
  });
});

describe("buildPeriodAiPrompt", () => {
  it("pede JSON com factId e envia somente fatos anônimos", () => {
    const factSheet = buildPeriodAiFactSheet(buildFixtureAnalysis());
    const [system, user] = buildPeriodAiPrompt(factSheet);

    expect(system.role).toBe("system");
    expect(system.content).toContain("factId");
    expect(system.content).toContain("JSON");
    expect(system.content.toLowerCase()).toContain("não invente");

    const parsed = JSON.parse(user.content) as {
      facts: unknown;
      factIds: string[];
    };
    expect(parsed.factIds).toContain("lever-0");
    const serializedFacts = JSON.stringify(parsed.facts);
    expect(serializedFacts).not.toContain("iFood");
    expect(serializedFacts).not.toContain("Netflix");
    expect(serializedFacts).not.toContain("Notebook");
    expect(serializedFacts).not.toContain("Aluguel");
  });
});

describe("parsePeriodAiNarrative", () => {
  const factIds = ["flow", "lever-0", "category-alimentacao"];

  it("aceita JSON válido e remove ação com factId desconhecido", () => {
    const narrative = parsePeriodAiNarrative(
      JSON.stringify({
        summary: "Resumo com números.",
        actions: [
          { factId: "lever-0", text: "Cortar 1 compra." },
          { factId: "inventado", text: "Ação inválida." },
        ],
      }),
      factIds,
    );

    expect(narrative).toEqual({
      summary: "Resumo com números.",
      actions: [{ factId: "lever-0", text: "Cortar 1 compra." }],
    });
  });

  it("remove cercas de código markdown", () => {
    const narrative = parsePeriodAiNarrative(
      '```json\n{"summary":"Ok","actions":[]}\n```',
      factIds,
    );
    expect(narrative).toEqual({ summary: "Ok", actions: [] });
  });

  it("devolve null para JSON inválido, resumo vazio ou mais de 3 ações", () => {
    expect(parsePeriodAiNarrative("não é json", factIds)).toBeNull();
    expect(
      parsePeriodAiNarrative(
        JSON.stringify({ summary: " ", actions: [] }),
        factIds,
      ),
    ).toBeNull();
    expect(
      parsePeriodAiNarrative(
        JSON.stringify({
          summary: "Ok",
          actions: Array.from({ length: 4 }, () => ({
            factId: "flow",
            text: "Ação",
          })),
        }),
        factIds,
      ),
    ).toBeNull();
  });
});

describe("localPeriodAiNarrative", () => {
  it("reaproveita resumo e levers determinísticos", () => {
    const narrative = localPeriodAiNarrative(buildFixtureAnalysis());

    expect(normalizeMoneyText(narrative.summary)).toContain(
      "Sobra média de R$ 200,00",
    );
    expect(normalizeMoneyText(narrative.summary)).toContain(
      "Reserva confirmada: R$ 1.600,00",
    );
    expect(normalizeMoneyText(narrative.summary)).toContain(
      "Cortes sugeridos: R$ 94,90/mês.",
    );
    expect(narrative.actions).toHaveLength(2);
    expect(narrative.actions[0].factId).toBe("lever-0");
    expect(narrative.actions[0].text).toContain("iFood");
  });

  it("usa o texto de vazio quando não há dados", () => {
    const narrative = localPeriodAiNarrative(
      buildPeriodAnalysis({ months: [] }),
    );
    expect(narrative.summary).toBe(
      "Ainda não há dados suficientes para o diagnóstico do período.",
    );
    expect(narrative.actions).toEqual([]);
  });
});
