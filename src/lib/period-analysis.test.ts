import { describe, expect, it } from "vitest";
import {
  buildPeriodAnalysis,
  cleanMerchantDisplay,
  monthKeysBetween,
  normalizeMerchantKey,
  periodConfidenceLabel,
  previousMonthKey,
  surplusTrendLabel,
  totalMonthlySavingsCents,
  type PeriodCardPurchase,
  type PeriodMonth,
  type PeriodTransaction,
} from "./period-analysis";

/* -------------------------------------------------------------------------- */
/* Fixtures                                                                    */
/* -------------------------------------------------------------------------- */

function at(isoDate: string): Date {
  // Meio-dia UTC: o dia/mês não muda no fuso da família (America/Sao_Paulo).
  return new Date(`${isoDate}T12:00:00.000Z`);
}

function makeMonth(
  monthKey: string,
  overrides: Partial<PeriodMonth> = {},
): PeriodMonth {
  return {
    monthKey,
    incomeCents: 100000,
    consumedCents: 80000,
    fixedExpensesCents: 50000,
    variableExpensesCents: 30000,
    cardExpensesCents: 0,
    categories: [],
    daysInMonth: 30,
    ...overrides,
  };
}

function makeTransaction(
  overrides: Partial<PeriodTransaction> & {
    description: string;
    amountCents: number;
    date: Date;
  },
): PeriodTransaction {
  return {
    source: "variable",
    paymentMethod: "PIX",
    ...overrides,
  };
}

function makeCardPurchase(
  overrides: Partial<PeriodCardPurchase> & {
    description: string;
    amountCents: number;
    purchaseDate: Date;
  },
): PeriodCardPurchase {
  return {
    cardId: "card-1",
    card: { closingDay: 20, dueDay: 5 },
    installmentsTotal: 1,
    ...overrides,
  };
}

function normalizeMoneyText(value: string): string {
  return value.replace(/\u00a0/g, " ");
}

/* -------------------------------------------------------------------------- */
/* Vazio e fluxo                                                               */
/* -------------------------------------------------------------------------- */

describe("buildPeriodAnalysis — entrada vazia", () => {
  it("devolve zeros, listas vazias e confiança baixa sem lançar", () => {
    const analysis = buildPeriodAnalysis({ months: [] });

    expect(analysis.period).toEqual({
      from: "",
      to: "",
      monthsCount: 0,
      closedMonthsCount: 0,
      includesCurrent: false,
      confidence: "low",
    });
    expect(analysis.flow.months).toEqual([]);
    expect(analysis.flow.averageIncomeCents).toBe(0);
    expect(analysis.flow.bestMonth).toBeNull();
    expect(analysis.flow.worstMonth).toBeNull();
    expect(analysis.flow.trend).toBe("unknown");
    expect(analysis.pace).toBeNull();
    expect(analysis.composition.totalConsumedCents).toBe(0);
    expect(analysis.commitments.fixedExpensesTotalCents).toBe(0);
    expect(analysis.behavior.transactionCount).toBe(0);
    expect(analysis.dataQuality.confidence).toBe("low");
    expect(analysis.reserve.confirmedCents).toBeNull();
    expect(analysis.reserve.emergencyTargetCents).toBe(0);
    expect(analysis.levers).toEqual([]);
    expect(analysis.anomalies.map((anomaly) => anomaly.kind)).toEqual([
      "short-history",
    ]);
  });
});

describe("buildPeriodAnalysis — fluxo", () => {
  it("calcula sobra, taxa de poupança, melhor/pior mês e tendência", () => {
    const analysis = buildPeriodAnalysis({
      months: [
        makeMonth("2026-01", {
          consumedCents: 80000,
          variableExpensesCents: 30000,
        }),
        makeMonth("2026-02", {
          consumedCents: 90000,
          variableExpensesCents: 40000,
        }),
        makeMonth("2026-03", {
          consumedCents: 110000,
          variableExpensesCents: 60000,
        }),
        makeMonth("2026-04", {
          consumedCents: 70000,
          variableExpensesCents: 20000,
        }),
      ],
    });

    expect(analysis.flow.closedMonthsCount).toBe(4);
    expect(analysis.flow.averageIncomeCents).toBe(100000);
    expect(analysis.flow.averageConsumedCents).toBe(87500);
    expect(analysis.flow.averageSurplusCents).toBe(12500);
    expect(analysis.flow.medianSurplusCents).toBe(15000);
    expect(analysis.flow.savingsRatePercent).toBe(12.5);
    expect(analysis.flow.positiveMonths).toBe(3);
    expect(analysis.flow.negativeMonths).toBe(1);
    expect(analysis.flow.bestMonth?.monthKey).toBe("2026-04");
    expect(analysis.flow.bestMonth?.surplusCents).toBe(30000);
    expect(analysis.flow.worstMonth?.monthKey).toBe("2026-03");
    expect(analysis.flow.worstMonth?.surplusCents).toBe(-10000);
    expect(analysis.flow.trend).toBe("worsening");
    expect(analysis.flow.trendDeltaCents).toBe(-5000);
    expect(analysis.period.confidence).toBe("medium");

    const negative = analysis.anomalies.find(
      (anomaly) => anomaly.kind === "negative-surplus",
    );
    expect(negative).toBeDefined();
    expect(normalizeMoneyText(negative?.detail ?? "")).toContain(
      "Em março de 2026, o consumo passou da renda em R$ 100,00.",
    );
  });

  it("não divide por zero quando a renda é 0 e mantém os números finitos", () => {
    const analysis = buildPeriodAnalysis({
      months: [
        makeMonth("2026-01", {
          incomeCents: 0,
          consumedCents: 50000,
          fixedExpensesCents: 30000,
          variableExpensesCents: 20000,
        }),
      ],
    });

    expect(analysis.flow.averageIncomeCents).toBe(0);
    expect(analysis.flow.savingsRatePercent).toBe(0);
    expect(analysis.flow.months[0].savingsRatePercent).toBe(0);
    expect(analysis.flow.months[0].consumedPercent).toBe(0);
    expect(Number.isFinite(analysis.flow.averageSurplusCents)).toBe(true);
    expect(analysis.flow.averageSurplusCents).toBe(-50000);
  });

  it("marca tendência estável quando a variação fica abaixo do ruído", () => {
    const analysis = buildPeriodAnalysis({
      months: [
        makeMonth("2026-01", { consumedCents: 70000 }),
        makeMonth("2026-02", { consumedCents: 70000 }),
        makeMonth("2026-03", { consumedCents: 71000 }),
        makeMonth("2026-04", { consumedCents: 69000 }),
      ],
    });

    expect(analysis.flow.trend).toBe("stable");
    expect(analysis.flow.trendDeltaCents).toBe(0);
  });
});

describe("buildPeriodAnalysis — confiança", () => {
  function transactionsForMonths(
    monthKeys: string[],
    overrides: Partial<PeriodTransaction> = {},
  ): PeriodTransaction[] {
    return monthKeys.map((key, index) =>
      makeTransaction({
        description: `Compra ${index}`,
        amountCents: 10000,
        date: at(`${key}-10`),
        category: "Casa",
        ...overrides,
      }),
    );
  }

  it("sobe para alta com 6 meses fechados e dados categorizados", () => {
    const monthKeys = monthKeysBetween("2025-11", "2026-04");
    const analysis = buildPeriodAnalysis({
      months: monthKeys.map((key) => makeMonth(key)),
      transactions: transactionsForMonths(monthKeys),
    });

    expect(analysis.dataQuality.confidence).toBe("high");
    expect(analysis.period.confidence).toBe("high");
  });

  it("cai para média quando mais de 20% do valor está sem categoria", () => {
    const monthKeys = monthKeysBetween("2025-11", "2026-04");
    const analysis = buildPeriodAnalysis({
      months: monthKeys.map((key) => makeMonth(key)),
      transactions: [
        ...transactionsForMonths(monthKeys),
        makeTransaction({
          description: "Sem categoria",
          amountCents: 100000,
          date: at("2026-04-11"),
          category: null,
        }),
      ],
    });

    expect(analysis.dataQuality.uncategorizedSharePercent).toBeGreaterThan(20);
    expect(analysis.dataQuality.confidence).toBe("medium");
  });

  it("cai para média quando há crédito sem compra de cartão", () => {
    const monthKeys = monthKeysBetween("2025-11", "2026-04");
    const analysis = buildPeriodAnalysis({
      months: monthKeys.map((key) => makeMonth(key)),
      transactions: [
        ...transactionsForMonths(monthKeys),
        makeTransaction({
          description: "Crédito solto",
          amountCents: 20000,
          date: at("2026-04-12"),
          category: "Casa",
          paymentMethod: "CREDIT",
        }),
      ],
    });

    expect(analysis.dataQuality.creditExpensesWithoutCardCount).toBe(1);
    expect(analysis.dataQuality.confidence).toBe("medium");
  });

  it("fica baixa com menos de 3 meses fechados", () => {
    const analysis = buildPeriodAnalysis({
      months: [makeMonth("2026-01"), makeMonth("2026-02")],
    });

    expect(analysis.dataQuality.confidence).toBe("low");
    expect(analysis.period.confidence).toBe("low");
  });
});

/* -------------------------------------------------------------------------- */
/* Ritmo                                                                       */
/* -------------------------------------------------------------------------- */

describe("buildPeriodAnalysis — ritmo", () => {
  it("compara o dia do ciclo com a mediana dos ciclos anteriores", () => {
    const daily = (amountCents: number) =>
      Array.from({ length: 30 }, (_, index) =>
        index === 9 ? amountCents : 0,
      );

    const analysis = buildPeriodAnalysis({
      months: [
        makeMonth("2026-01", { variableDailyCents: daily(10000) }),
        makeMonth("2026-02", { variableDailyCents: daily(20000) }),
        makeMonth("2026-03", { variableDailyCents: daily(30000) }),
      ],
      current: makeMonth("2026-04", {
        daysInMonth: 30,
        elapsedDay: 10,
        consumedCents: 70000,
        fixedExpensesCents: 40000,
        variableExpensesCents: 30000,
        variableDailyCents: daily(30000),
        isCurrent: true,
      }),
    });

    expect(analysis.pace).not.toBeNull();
    expect(analysis.pace?.elapsedDay).toBe(10);
    expect(analysis.pace?.currentVariableSpendCents).toBe(30000);
    expect(analysis.pace?.typicalVariableSpendAtSameDayCents).toBe(20000);
    expect(analysis.pace?.deltaCents).toBe(10000);
    expect(analysis.pace?.deltaPercent).toBe(50);
    expect(analysis.pace?.baselineMonthsCount).toBe(3);
    expect(analysis.pace?.projectedVariableSpendCents).toBe(90000);
    expect(analysis.pace?.projectedConsumedCents).toBe(130000);
    expect(analysis.pace?.projectedConsumedPercent).toBe(130);
    expect(
      analysis.anomalies.some((anomaly) => anomaly.kind === "pace-above"),
    ).toBe(true);
  });

  it("ignora meses com série menor que o dia decorrido e usa resíduo no projetado", () => {
    const analysis = buildPeriodAnalysis({
      months: [
        makeMonth("2026-01", {
          variableDailyCents: Array.from({ length: 9 }, () => 1000),
        }),
        makeMonth("2026-02", {
          variableDailyCents: Array.from({ length: 30 }, (_, index) =>
            index === 9 ? 20000 : 0,
          ),
        }),
      ],
      current: makeMonth("2026-03", {
        daysInMonth: 30,
        elapsedDay: 10,
        consumedCents: 70000,
        fixedExpensesCents: 40000,
        variableExpensesCents: 30000,
        // Série só com avulsos; o cartão (10.000) fica no resíduo.
        cardExpensesCents: 10000,
        variableDailyCents: Array.from({ length: 30 }, (_, index) =>
          index === 9 ? 30000 : 0,
        ),
        isCurrent: true,
      }),
    });

    expect(analysis.pace?.baselineMonthsCount).toBe(1);
    expect(analysis.pace?.typicalVariableSpendAtSameDayCents).toBe(20000);
    // consumido 70.000 − série 30.000 = 40.000 de resíduo + 90.000 projetado.
    expect(analysis.pace?.projectedConsumedCents).toBe(130000);
  });
});

/* -------------------------------------------------------------------------- */
/* Composição                                                                  */
/* -------------------------------------------------------------------------- */

describe("buildPeriodAnalysis — composição", () => {
  it("compara categorias com a base e calcula shares e desvios", () => {
    const analysis = buildPeriodAnalysis({
      months: [
        makeMonth("2026-01", {
          fixedExpensesCents: 40000,
          variableExpensesCents: 30000,
          cardExpensesCents: 10000,
          categories: [
            { category: "Mercado", amountCents: 20000 },
            { category: "Delivery", amountCents: 10000 },
            { category: "Casa", amountCents: 35000 },
          ],
        }),
        makeMonth("2026-02", {
          fixedExpensesCents: 40000,
          variableExpensesCents: 30000,
          cardExpensesCents: 10000,
          categories: [
            { category: "Mercado", amountCents: 20000 },
            { category: "Delivery", amountCents: 10000 },
            { category: "Casa", amountCents: 35000 },
          ],
        }),
        makeMonth("2026-03", {
          fixedExpensesCents: 40000,
          variableExpensesCents: 30000,
          cardExpensesCents: 10000,
          categories: [
            { category: "Mercado", amountCents: 20000 },
            { category: "Delivery", amountCents: 10000 },
            { category: "Casa", amountCents: 35000 },
          ],
        }),
      ],
      current: makeMonth("2026-04", {
        consumedCents: 80000,
        fixedExpensesCents: 40000,
        variableExpensesCents: 30000,
        cardExpensesCents: 10000,
        categories: [
          { category: "Mercado", amountCents: 30000 },
          { category: "Delivery", amountCents: 10000 },
          { category: "Casa", amountCents: 35000 },
          { category: "Sem categoria", amountCents: 5000 },
        ],
        isCurrent: true,
      }),
    });

    const mercado = analysis.composition.categories.find(
      (category) => category.category === "Mercado",
    );
    expect(mercado).toMatchObject({
      currentCents: 30000,
      averageCents: 20000,
      medianCents: 20000,
      deltaCents: 10000,
      deltaPercent: 50,
      monthsPresent: 4,
    });
    expect(mercado?.shareOfConsumedPercent).toBe(37.5);
    expect(analysis.composition.topMovers[0].category).toBe("Mercado");
    expect(analysis.composition.fixedSharePercent).toBe(50);
    expect(analysis.composition.variableSharePercent).toBe(37.5);
    expect(analysis.composition.cardSharePercent).toBe(12.5);
    expect(analysis.composition.fixedCostRatioPercent).toBe(40);
    expect(analysis.composition.averageFixedCostRatioPercent).toBe(40);
    expect(analysis.composition.uncategorizedCents).toBe(5000);
    expect(analysis.composition.uncategorizedSharePercent).toBe(6.3);
    expect(
      analysis.anomalies.some(
        (anomaly) =>
          anomaly.kind === "category-spike" &&
          anomaly.id.includes("mercado"),
      ),
    ).toBe(true);
  });
});

/* -------------------------------------------------------------------------- */
/* Compromissos                                                                */
/* -------------------------------------------------------------------------- */

describe("buildPeriodAnalysis — compromissos", () => {
  const fixedExpenses = [
    { name: "Aluguel", amountCents: 250000, dueDay: 10, category: "Moradia" },
    { name: "Energia", amountCents: 28000, dueDay: 15, category: "Casa" },
    { name: "Internet", amountCents: 12000, dueDay: 20, category: "Casa" },
    {
      name: "Condomínio",
      amountCents: 30000,
      dueDay: 3,
      category: "Moradia",
    },
  ];
  const incomes = [
    { name: "Salário", amountCents: 850000, receiveDay: 5 },
    { name: "Salário cônjuge", amountCents: 620000, receiveDay: 5 },
  ];

  it("agrupa vencimentos, custo fixo e dinheiro que sai antes da renda", () => {
    const analysis = buildPeriodAnalysis({
      months: [makeMonth("2026-01", { incomeCents: 1470000 })],
      fixedExpenses,
      incomes,
    });

    expect(analysis.commitments.fixedExpensesTotalCents).toBe(320000);
    expect(analysis.commitments.fixedExpenseCount).toBe(4);
    expect(analysis.commitments.fixedCostRatioPercent).toBe(21.8);
    expect(analysis.commitments.largestFixedExpenses[0].name).toBe("Aluguel");
    expect(analysis.commitments.dueDayBuckets).toEqual([
      { label: "early", count: 2, amountCents: 280000 },
      { label: "mid", count: 2, amountCents: 40000 },
      { label: "late", count: 0, amountCents: 0 },
    ]);
    expect(analysis.commitments.firstIncomeDay).toBe(5);
    expect(analysis.commitments.fixedBeforeFirstIncomeCents).toBe(30000);
    expect(analysis.commitments.fixedBeforeFirstIncomePercent).toBe(9.4);
  });

  it("projeta parcelas futuras por competência e o comprometido por cartão", () => {
    const analysis = buildPeriodAnalysis({
      months: [makeMonth("2026-01", { incomeCents: 1470000 })],
      referenceMonthKey: "2026-01",
      monthsAhead: 6,
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
        makeCardPurchase({
          description: "Notebook",
          amountCents: 90000,
          purchaseDate: at("2026-01-10"),
          installmentsTotal: 3,
          category: "Casa",
        }),
      ],
    });

    expect(analysis.commitments.futureInstallments).toEqual([
      { monthKey: "2026-02", amountCents: 30000, purchaseCount: 1 },
      { monthKey: "2026-03", amountCents: 30000, purchaseCount: 1 },
      { monthKey: "2026-04", amountCents: 30000, purchaseCount: 1 },
    ]);
    expect(analysis.commitments.futureInstallmentsTotalCents).toBe(90000);
    expect(analysis.commitments.futureInstallmentsPeak?.monthKey).toBe(
      "2026-02",
    );
    expect(analysis.commitments.installmentPurchasesCount).toBe(1);
    expect(analysis.commitments.installmentPurchasesSharePercent).toBe(100);
    expect(analysis.commitments.cards[0]).toEqual({
      cardId: "card-1",
      cardName: "Cartão principal",
      futureCents: 90000,
      limitCents: 500000,
      limitUsagePercent: 18,
    });
  });

  it("avisa quando o pico de parcelas passa de 25% da renda média", () => {
    const analysis = buildPeriodAnalysis({
      months: [makeMonth("2026-01", { incomeCents: 100000 })],
      referenceMonthKey: "2026-01",
      cardPurchases: [
        makeCardPurchase({
          description: "Compra grande",
          amountCents: 300000,
          purchaseDate: at("2026-01-10"),
          installmentsTotal: 3,
        }),
      ],
    });

    expect(
      analysis.anomalies.some(
        (anomaly) => anomaly.kind === "installment-commitment",
      ),
    ).toBe(true);
  });
});

/* -------------------------------------------------------------------------- */
/* Comportamento e qualidade                                                   */
/* -------------------------------------------------------------------------- */

describe("buildPeriodAnalysis — comportamento", () => {
  const months = [
    makeMonth("2026-01"),
    makeMonth("2026-02"),
    makeMonth("2026-03"),
  ];

  const transactions: PeriodTransaction[] = [
    ...[
      "2026-01-05",
      "2026-01-20",
      "2026-02-05",
      "2026-02-20",
      "2026-03-05",
      "2026-03-20",
    ].map((date, index) =>
      makeTransaction({
        description: index % 2 === 0 ? "IFD*IFOOD" : "iFood",
        amountCents: 5500,
        date: at(date),
        category: "Alimentação",
      }),
    ),
    ...["2026-01-10", "2026-02-10", "2026-03-10"].map((date) =>
      makeTransaction({
        description: "Mercado",
        amountCents: 40000,
        date: at(date),
        category: "Alimentação",
      }),
    ),
    ...["2026-01-15", "2026-02-15", "2026-03-15"].map((date) =>
      makeTransaction({
        description: "Netflix",
        amountCents: 3990,
        date: at(date),
        category: "Casa",
        source: "card",
        installmentsTotal: 1,
      }),
    ),
    makeTransaction({
      description: "TV",
      amountCents: 200000,
      date: at("2026-02-10"),
      category: "Casa",
      source: "card",
      installmentsTotal: 3,
    }),
  ];

  it("agrupa merchant, calcula ticket/frequência e detecta recorrência", () => {
    const analysis = buildPeriodAnalysis({
      months,
      transactions,
    });

    const ifood = analysis.behavior.merchants.find(
      (merchant) => merchant.merchantKey === "ifood",
    );
    expect(ifood).toMatchObject({
      purchaseCount: 6,
      totalCents: 33000,
      averageTicketCents: 5500,
      medianTicketCents: 5500,
      monthsPresent: 3,
      monthlyFrequency: 2,
    });
    expect(analysis.behavior.topMerchants[0].merchantName).toBe("TV");
    expect(analysis.behavior.largePurchases[0].description).toBe("TV");
    expect(analysis.behavior.installmentPurchasesSharePercent).toBe(25);

    const netflix = analysis.behavior.recurringMerchants.find(
      (merchant) => merchant.merchantKey === "netflix",
    );
    expect(netflix?.likelySubscription).toBe(true);
    const mercado = analysis.behavior.recurringMerchants.find(
      (merchant) => merchant.merchantKey === "mercado",
    );
    expect(mercado?.likelySubscription).toBe(false);
  });

  it("detecta possível duplicidade e aumento de preço", () => {
    const analysis = buildPeriodAnalysis({
      months,
      transactions: [
        ...transactions,
        makeTransaction({
          description: "iFood",
          amountCents: 5500,
          date: at("2026-01-22"),
          category: "Alimentação",
        }),
        makeTransaction({
          description: "Netflix",
          amountCents: 4990,
          date: at("2026-03-15"),
          category: "Casa",
          source: "card",
          installmentsTotal: 1,
        }),
      ],
    });

    expect(
      analysis.anomalies.filter(
        (anomaly) => anomaly.kind === "duplicate-charge",
      ).length,
    ).toBeGreaterThan(0);
    expect(
      analysis.anomalies.some(
        (anomaly) =>
          anomaly.kind === "price-increase" &&
          anomaly.id.includes("netflix"),
      ),
    ).toBe(true);
  });

  it("respeita transações já recortadas pelo chamador", () => {
    const transaction = makeTransaction({
      description: "Mercado",
      amountCents: 10000,
      date: at("2026-02-10"),
      category: "Casa",
    });

    const filtered = buildPeriodAnalysis({
      months: [makeMonth("2026-01")],
      transactions: [transaction],
    });
    expect(filtered.behavior.transactionCount).toBe(0);

    const preFiltered = buildPeriodAnalysis({
      months: [makeMonth("2026-01")],
      transactions: [transaction],
      transactionsPreFiltered: true,
    });
    expect(preFiltered.behavior.transactionCount).toBe(1);
  });

  it("calcula a fatia de fim de período da série exibida", () => {
    const analysis = buildPeriodAnalysis({
      months,
      current: makeMonth("2026-04", {
        daysInMonth: 20,
        elapsedDay: 20,
        variableDailyCents: Array.from({ length: 20 }, (_, index) =>
          index < 15 ? 1000 : 5000,
        ),
        isCurrent: true,
      }),
    });

    // 15 dias × 1.000 + 5 dias × 5.000 = 40.000; última quarta parte = 25.000.
    expect(analysis.behavior.endOfPeriodVariableSharePercent).toBe(62.5);
  });
});

describe("buildPeriodAnalysis — qualidade dos dados", () => {
  it("mede sem categoria, crédito sem cartão, buracos e confiança", () => {
    const monthKeys = monthKeysBetween("2025-11", "2026-04");
    const analysis = buildPeriodAnalysis({
      months: monthKeys.map((key) => makeMonth(key)),
      expectedMonthKeys: [...monthKeys, "2026-05"],
      transactions: [
        makeTransaction({
          description: "Mercado",
          amountCents: 10000,
          date: at("2026-01-10"),
          category: null,
        }),
        makeTransaction({
          description: "Farmácia",
          amountCents: 5000,
          date: at("2026-01-11"),
          category: "Saúde",
          paymentMethod: "DEBIT",
        }),
        makeTransaction({
          description: "Compra crédito",
          amountCents: 20000,
          date: at("2026-01-12"),
          category: "Casa",
          paymentMethod: "CREDIT",
          creditCardId: "card-1",
        }),
        makeTransaction({
          description: "Compra crédito",
          amountCents: 20000,
          date: at("2026-01-12"),
          category: "Casa",
          source: "card",
          cardId: "card-1",
        }),
        makeTransaction({
          description: "Outra crédito",
          amountCents: 30000,
          date: at("2026-01-13"),
          category: "Casa",
          paymentMethod: "CREDIT",
          creditCardId: "card-1",
        }),
      ],
    });

    expect(analysis.dataQuality.transactionCount).toBe(5);
    expect(analysis.dataQuality.uncategorizedCount).toBe(1);
    expect(analysis.dataQuality.uncategorizedCents).toBe(10000);
    expect(analysis.dataQuality.uncategorizedSharePercent).toBe(11.8);
    expect(analysis.dataQuality.creditExpensesCount).toBe(2);
    expect(analysis.dataQuality.creditExpensesWithoutCardCount).toBe(1);
    expect(analysis.dataQuality.creditExpensesWithoutCardCents).toBe(30000);
    expect(analysis.dataQuality.creditExpensesWithoutCard[0].description).toBe(
      "Outra crédito",
    );
    expect(analysis.dataQuality.monthsWithoutDailySeries).toEqual(monthKeys);
    expect(analysis.dataQuality.missingMonths).toEqual(["2026-05"]);
    expect(analysis.dataQuality.confidence).toBe("medium");
  });

  it("casa crédito com parcela de compra de cartão", () => {
    const analysis = buildPeriodAnalysis({
      months: [makeMonth("2026-01")],
      transactions: [
        makeTransaction({
          description: "Notebook",
          amountCents: 30000,
          date: at("2026-01-10"),
          category: "Casa",
          paymentMethod: "CREDIT",
          creditCardId: "card-1",
        }),
        makeTransaction({
          description: "Notebook",
          amountCents: 90000,
          date: at("2026-01-10"),
          category: "Casa",
          source: "card",
          cardId: "card-1",
          installmentsTotal: 3,
        }),
      ],
    });

    expect(analysis.dataQuality.creditExpensesWithoutCardCount).toBe(0);
  });
});

/* -------------------------------------------------------------------------- */
/* Reserva e metas                                                             */
/* -------------------------------------------------------------------------- */

describe("buildPeriodAnalysis — reserva e metas", () => {
  const months = [
    makeMonth("2026-01", {
      incomeCents: 100000,
      consumedCents: 70000,
      fixedExpensesCents: 50000,
      variableExpensesCents: 20000,
    }),
    makeMonth("2026-02", {
      incomeCents: 100000,
      consumedCents: 70000,
      fixedExpensesCents: 50000,
      variableExpensesCents: 20000,
    }),
    makeMonth("2026-03", {
      incomeCents: 100000,
      consumedCents: 70000,
      fixedExpensesCents: 50000,
      variableExpensesCents: 20000,
    }),
    makeMonth("2026-04", {
      incomeCents: 100000,
      consumedCents: 70000,
      fixedExpensesCents: 50000,
      variableExpensesCents: 20000,
    }),
  ];

  it("calcula cobertura, gap, meses para o alvo e reconciliação", () => {
    const analysis = buildPeriodAnalysis({
      months,
      referenceMonthKey: "2026-04",
      reserveSnapshots: [
        { monthKey: "2026-01", amountCents: 100000 },
        { monthKey: "2026-04", amountCents: 160000 },
      ],
      goals: [
        {
          id: "viagem",
          name: "Viagem",
          targetCents: 200000,
          allocatedCents: 50000,
        },
      ],
    });

    expect(analysis.reserve.confirmedCents).toBe(160000);
    expect(analysis.reserve.monthKey).toBe("2026-04");
    expect(analysis.reserve.ageMonths).toBe(0);
    expect(analysis.reserve.averageFixedExpensesCents).toBe(50000);
    expect(analysis.reserve.targetMonths).toBe(6);
    expect(analysis.reserve.emergencyTargetCents).toBe(300000);
    expect(analysis.reserve.emergencyCents).toBe(110000);
    expect(analysis.reserve.coverageMonths).toBe(2.2);
    expect(analysis.reserve.gapCents).toBe(190000);
    expect(analysis.reserve.monthsToTarget).toBe(7);
    expect(analysis.reserve.inferredAccumulatedSurplusCents).toBe(120000);
    expect(analysis.reserve.reserveDeltaCents).toBe(60000);
    expect(analysis.reserve.inferredBetweenSnapshotsCents).toBe(90000);
    expect(analysis.reserve.unaccountedCents).toBe(30000);
    expect(analysis.reserve.confirmsBaseline).toBe(true);
    expect(analysis.reserve.goals[0]).toMatchObject({
      id: "viagem",
      targetCents: 200000,
      allocatedCents: 50000,
      gapCents: 150000,
      progressPercent: 25,
    });
    expect(
      analysis.anomalies.some(
        (anomaly) => anomaly.kind === "reserve-unaccounted",
      ),
    ).toBe(true);
  });

  it("sem baseline não inventa discrepância; sem reserva não inventa cobertura", () => {
    const withoutBaseline = buildPeriodAnalysis({
      months,
      reserveSnapshots: [{ monthKey: "2026-04", amountCents: 160000 }],
    });
    expect(withoutBaseline.reserve.reserveDeltaCents).toBeNull();
    expect(withoutBaseline.reserve.inferredBetweenSnapshotsCents).toBeNull();
    expect(withoutBaseline.reserve.unaccountedCents).toBeNull();
    expect(withoutBaseline.reserve.confirmsBaseline).toBe(false);
    expect(withoutBaseline.reserve.coverageMonths).toBe(3.2);
    expect(withoutBaseline.reserve.gapCents).toBe(140000);
    expect(withoutBaseline.reserve.monthsToTarget).toBe(5);

    const withoutReserve = buildPeriodAnalysis({ months });
    expect(withoutReserve.reserve.confirmedCents).toBeNull();
    expect(withoutReserve.reserve.coverageMonths).toBeNull();
    expect(withoutReserve.reserve.gapCents).toBeNull();
    expect(withoutReserve.reserve.monthsToTarget).toBeNull();
    expect(withoutReserve.reserve.emergencyTargetCents).toBe(300000);
    expect(withoutReserve.reserve.inferredAccumulatedSurplusCents).toBe(
      120000,
    );
  });
});

/* -------------------------------------------------------------------------- */
/* Levers                                                                      */
/* -------------------------------------------------------------------------- */

describe("buildPeriodAnalysis — levers", () => {
  function monthsWithCategory(): PeriodMonth[] {
    return [
      makeMonth("2026-01", {
        categories: [
          { category: "Alimentação", amountCents: 30000 },
          { category: "Casa", amountCents: 50000 },
        ],
      }),
      makeMonth("2026-02", {
        categories: [
          { category: "Alimentação", amountCents: 30000 },
          { category: "Casa", amountCents: 50000 },
        ],
      }),
      makeMonth("2026-03", {
        categories: [
          { category: "Alimentação", amountCents: 30000 },
          { category: "Casa", amountCents: 50000 },
        ],
      }),
    ];
  }

  it("propõe cortar frequência e revisar assinatura, sem duplicar categoria", () => {
    const transactions: PeriodTransaction[] = [
      ...Array.from({ length: 12 }, (_, index) =>
        makeTransaction({
          description: "iFood",
          amountCents: 5500,
          date: at(
            `2026-0${(index % 3) + 1}-${String(
              5 + Math.floor(index / 3) * 4,
            ).padStart(2, "0")}`,
          ),
          category: "Alimentação",
        }),
      ),
      ...["2026-01-15", "2026-02-15", "2026-03-15"].map((date) =>
        makeTransaction({
          description: "Netflix",
          amountCents: 3990,
          date: at(date),
          category: "Casa",
          source: "card",
          installmentsTotal: 1,
        }),
      ),
    ];

    const analysis = buildPeriodAnalysis({
      months: monthsWithCategory(),
      transactions,
    });

    const frequency = analysis.levers.find(
      (lever) => lever.kind === "frequency",
    );
    expect(frequency).toMatchObject({
      merchantKey: "ifood",
      currentMonthlyCount: 4,
      currentAverageTicketCents: 5500,
      proposedReduction: 1,
      monthlySavingsCents: 5500,
      confidence: "high",
    });
    expect(frequency?.reason).toContain("Cortar 1 por mês");

    const subscription = analysis.levers.find(
      (lever) => lever.kind === "subscription",
    );
    expect(subscription).toMatchObject({
      merchantKey: "netflix",
      monthlySavingsCents: 3990,
    });

    expect(
      analysis.levers.some(
        (lever) =>
          lever.kind === "category" &&
          lever.category === "Alimentação",
      ),
    ).toBe(false);
    expect(totalMonthlySavingsCents(analysis)).toBe(9490);
  });

  it("respeita categorias essenciais", () => {
    const analysis = buildPeriodAnalysis({
      months: monthsWithCategory(),
      essentialCategories: ["alimentação"],
      transactions: Array.from({ length: 12 }, (_, index) =>
        makeTransaction({
          description: "iFood",
          amountCents: 5500,
          date: at(
            `2026-0${(index % 3) + 1}-${String(
              5 + Math.floor(index / 3) * 4,
            ).padStart(2, "0")}`,
          ),
          category: "Alimentação",
        }),
      ),
    });

    expect(
      analysis.levers.some((lever) => lever.kind === "frequency"),
    ).toBe(false);
    expect(
      analysis.levers.some(
        (lever) =>
          lever.kind === "category" && lever.category === "Alimentação",
      ),
    ).toBe(false);
  });

  it("propõe ticket quando o médio passa da mediana sem frequência alta", () => {
    const amounts = [
      60000, 60000, 60000, 60000, 60000, 105000, 105000, 105000, 105000,
    ];
    const dates = [
      "2026-01-05",
      "2026-01-10",
      "2026-01-15",
      "2026-02-05",
      "2026-02-10",
      "2026-02-15",
      "2026-03-05",
      "2026-03-10",
      "2026-03-15",
    ];
    const analysis = buildPeriodAnalysis({
      months: monthsWithCategory(),
      transactions: amounts.map((amountCents, index) =>
        makeTransaction({
          description: "Mercado",
          amountCents,
          date: at(dates[index]),
          category: "Alimentação",
        }),
      ),
    });

    const ticket = analysis.levers.find(
      (lever) => lever.kind === "ticket",
    );
    expect(ticket).toMatchObject({
      merchantKey: "mercado",
      monthlySavingsCents: 60000,
      confidence: "medium",
    });
  });

  it("propõe corte de categoria quando não há merchant específico", () => {
    const analysis = buildPeriodAnalysis({
      months: monthsWithCategory(),
      current: makeMonth("2026-04", {
        categories: [
          { category: "Alimentação", amountCents: 60000 },
          { category: "Casa", amountCents: 50000 },
        ],
        consumedCents: 110000,
        isCurrent: true,
      }),
    });

    const category = analysis.levers.find(
      (lever) => lever.kind === "category",
    );
    expect(category).toMatchObject({
      category: "Alimentação",
      monthlySavingsCents: 30000,
      confidence: "medium",
    });
    expect(category?.reason).toContain("Voltar à base");
  });

  it("propõe redução de 2 por mês quando a frequência é alta", () => {
    const analysis = buildPeriodAnalysis({
      months: monthsWithCategory(),
      transactions: Array.from({ length: 24 }, (_, index) =>
        makeTransaction({
          description: "iFood",
          amountCents: 5000,
          date: at(
            `2026-0${(index % 3) + 1}-${String(
              3 + Math.floor(index / 3) * 2,
            ).padStart(2, "0")}`,
          ),
          category: "Alimentação",
        }),
      ),
    });

    expect(
      analysis.levers.find((lever) => lever.kind === "frequency"),
    ).toMatchObject({
      currentMonthlyCount: 8,
      proposedReduction: 2,
      monthlySavingsCents: 10000,
    });
  });
});

/* -------------------------------------------------------------------------- */
/* Utilidades e cenário do seed                                                */
/* -------------------------------------------------------------------------- */

describe("helpers de período", () => {
  it("normaliza merchant e remove prefixo/sufixo de cartão", () => {
    expect(normalizeMerchantKey("IFD*IFOOD - Parcela 2/3")).toBe("ifood");
    expect(normalizeMerchantKey("iFood")).toBe("ifood");
    expect(normalizeMerchantKey("Farmácia")).toBe("farmacia");
    expect(normalizeMerchantKey("Mercado   ")).toBe("mercado");
    expect(cleanMerchantDisplay("IFD*IFOOD - Parcela 2/3")).toBe("IFOOD");
    expect(cleanMerchantDisplay("iFood")).toBe("iFood");
  });

  it("calcula meses entre chaves e desloca um mês", () => {
    expect(previousMonthKey("2026-01")).toBe("2025-12");
    expect(monthKeysBetween("2025-11", "2026-02")).toEqual([
      "2025-11",
      "2025-12",
      "2026-01",
      "2026-02",
    ]);
    expect(monthKeysBetween("2026-02", "2026-01")).toEqual([]);
  });

  it("expõe rótulos estáveis de confiança e tendência", () => {
    expect(periodConfidenceLabel("high")).toBe("Base confiável");
    expect(periodConfidenceLabel("medium")).toBe("Base parcial");
    expect(periodConfidenceLabel("low")).toBe("Base curta");
    expect(surplusTrendLabel("improving")).toBe("Sobra crescendo");
    expect(surplusTrendLabel("worsening")).toBe("Sobra caindo");
    expect(surplusTrendLabel("stable")).toBe("Sobra estável");
    expect(surplusTrendLabel("unknown")).toBe("Sem tendência");
  });

  it("não muta as coleções de entrada", () => {
    const months = Object.freeze([
      Object.freeze(makeMonth("2026-01")),
      Object.freeze(makeMonth("2026-02")),
    ]) as unknown as PeriodMonth[];
    const transactions = Object.freeze([
      Object.freeze(
        makeTransaction({
          description: "Mercado",
          amountCents: 10000,
          date: at("2026-01-10"),
          category: "Alimentação",
        }),
      ),
    ]) as unknown as PeriodTransaction[];

    expect(() =>
      buildPeriodAnalysis({ months, transactions }),
    ).not.toThrow();
    expect(months.map((month) => month.monthKey)).toEqual([
      "2026-01",
      "2026-02",
    ]);
  });
});

describe("buildPeriodAnalysis — cenário do seed", () => {
  const incomeCents = 1470000;
  const fixedExpensesCents = 290000;
  const cardExpensesCents = 60000;
  const historicalVariable = [150000, 170000, 140000, 190000];

  function snapshotMonth(
    monthKey: string,
    variableCents: number,
    isCurrent = false,
  ): PeriodMonth {
    const days = isCurrent ? 31 : 30;
    return makeMonth(monthKey, {
      incomeCents,
      consumedCents:
        fixedExpensesCents + variableCents + cardExpensesCents,
      fixedExpensesCents,
      variableExpensesCents: variableCents,
      cardExpensesCents,
      daysInMonth: days,
      elapsedDay: isCurrent ? 18 : days,
      variableDailyCents: Array.from({ length: days }, (_, index) =>
        index === 2 ? variableCents : 0,
      ),
      obligationDailyCents: Array.from({ length: days }, (_, index) =>
        index === 9 ? fixedExpensesCents + cardExpensesCents : 0,
      ),
      isCurrent,
    });
  }

  const months = historicalVariable.map((value, index) =>
    snapshotMonth(`2026-0${index + 1}`, value),
  );
  const current = snapshotMonth("2026-05", 53000, true);

  it("fecha fluxo, ritmo e reserva com os números do seed", () => {
    const analysis = buildPeriodAnalysis({
      months,
      current,
      referenceMonthKey: "2026-05",
    });

    expect(analysis.period).toMatchObject({
      from: "2026-01",
      to: "2026-05",
      monthsCount: 5,
      closedMonthsCount: 4,
      includesCurrent: true,
      confidence: "medium",
    });
    expect(analysis.flow.averageIncomeCents).toBe(1470000);
    expect(analysis.flow.averageConsumedCents).toBe(512500);
    expect(analysis.flow.averageSurplusCents).toBe(957500);
    expect(analysis.flow.medianSurplusCents).toBe(960000);
    expect(analysis.flow.savingsRatePercent).toBe(65.1);
    expect(analysis.flow.positiveMonths).toBe(4);
    expect(analysis.flow.negativeMonths).toBe(0);
    expect(analysis.flow.bestMonth?.monthKey).toBe("2026-03");
    expect(analysis.flow.worstMonth?.monthKey).toBe("2026-04");
    expect(analysis.flow.trend).toBe("stable");
    expect(analysis.flow.trendDeltaCents).toBe(-5000);
    expect(analysis.flow.months[4]).toMatchObject({
      monthKey: "2026-05",
      consumedCents: 403000,
      surplusCents: 1067000,
      savingsRatePercent: 72.6,
      isCurrent: true,
    });

    expect(analysis.pace).toMatchObject({
      elapsedDay: 18,
      currentVariableSpendCents: 53000,
      typicalVariableSpendAtSameDayCents: 160000,
      deltaCents: -107000,
      deltaPercent: -66.9,
      projectedVariableSpendCents: 91278,
      projectedConsumedCents: 441278,
      projectedConsumedPercent: 30,
      baselineMonthsCount: 4,
    });

    expect(analysis.reserve.confirmedCents).toBeNull();
    expect(analysis.reserve.emergencyTargetCents).toBe(1740000);
    expect(analysis.reserve.inferredAccumulatedSurplusCents).toBe(3830000);
    expect(analysis.anomalies).toEqual([]);
  });
});
