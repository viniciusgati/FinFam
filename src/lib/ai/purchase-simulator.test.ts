import { describe, expect, it } from "vitest";
import { usualDailySpendCents } from "../cycle";
import {
  buildPurchaseData,
  buildPurchasePrompt,
  VERDICT_LABELS,
  simulatePurchase,
} from "./purchase-simulator";

// R$ 2.000 livres, R$ 250/dia, 8 dias restantes, ritmo recente de R$ 200/dia.
const base = {
  freeBudgetCents: 200000,
  dailyCents: 25000,
  remainingDays: 8,
  usualDailySpendCents: 20000,
};

function plain(text: string): string {
  return text.replace(/\u00a0/g, " ");
}

describe("simulatePurchase — impacto no poder de compra", () => {
  it("compra pequena mantém o ritmo → ok", () => {
    const result = simulatePurchase({ ...base, purchaseCents: 20000 });

    expect(result.verdict).toBe("ok");
    expect(result.label).toBe(VERDICT_LABELS.ok);
    expect(plain(result.impactLabel)).toContain(
      "de R$ 250,00 para R$ 225,00 por dia",
    );
    expect(plain(result.impactLabel)).toContain("(−R$ 25,00 por dia)");
  });

  it("compra que derruba a diária abaixo do ritmo → cuidado", () => {
    const result = simulatePurchase({ ...base, purchaseCents: 80000 });

    expect(result.verdict).toBe("cuidado");
    expect(result.summary).toContain("gastar menos");
  });

  it("compra que deixa menos da metade do ritmo → nao", () => {
    const result = simulatePurchase({ ...base, purchaseCents: 160000 });

    expect(result.verdict).toBe("nao");
    expect(result.summary).toContain("menos da metade");
  });

  it("compra que não cabe no orçamento do ciclo → nao com o valor que falta", () => {
    const result = simulatePurchase({ ...base, purchaseCents: 250000 });

    expect(result.verdict).toBe("nao");
    expect(plain(result.summary)).toContain("não cabe");
    expect(plain(result.summary)).toContain("R$ 500,00");
  });

  it("ciclo já estourado → nao e aponta o aumento do estouro", () => {
    const result = simulatePurchase({
      freeBudgetCents: 0,
      dailyCents: -1000,
      remainingDays: 8,
      usualDailySpendCents: 20000,
      purchaseCents: 10000,
    });

    expect(result.verdict).toBe("nao");
    expect(result.summary).toContain("já está estourado");
  });
});

describe("simulatePurchase — sem ritmo medido", () => {
  it("usa metade da diária como piso: acima → ok", () => {
    const result = simulatePurchase({
      ...base,
      usualDailySpendCents: null,
      purchaseCents: 30000,
    });

    expect(result.verdict).toBe("ok");
  });

  it("usa metade da diária como piso: abaixo → cuidado", () => {
    const result = simulatePurchase({
      ...base,
      usualDailySpendCents: null,
      purchaseCents: 150000,
    });

    expect(result.verdict).toBe("cuidado");
  });
});

describe("simulatePurchase — limites", () => {
  it("ritmo acima da diária não exige diária menor que o próprio ritmo", () => {
    // usual (30000) > diária (25000): referência vira 25000; a compra que
    // deixa exatamente 90% da diária ainda é "ok".
    const result = simulatePurchase({
      ...base,
      usualDailySpendCents: 30000,
      purchaseCents: 20000,
    });

    expect(result.verdict).toBe("ok");
  });

  it("faltando 1 centavo para caber já é nao", () => {
    const result = simulatePurchase({ ...base, purchaseCents: 200001 });
    expect(result.verdict).toBe("nao");
  });

  it("caber exatamente no orçamento não é ok", () => {
    const result = simulatePurchase({ ...base, purchaseCents: 200000 });
    expect(result.verdict).toBe("nao");
  });
});

describe("simulatePurchase — compra parcelada", () => {
  it("sem installmentsTotal é idêntico à compra à vista", () => {
    const avista = simulatePurchase({ ...base, purchaseCents: 80000 });
    const semParcelas = simulatePurchase({
      ...base,
      purchaseCents: 80000,
      installmentsTotal: undefined,
    });

    expect(semParcelas).toEqual(avista);
    expect(semParcelas.installmentsTotal).toBe(1);
    expect(semParcelas.installmentLabel).toBe(
      "Compra à vista: sem parcelas futuras.",
    );
  });

  it("100000 em 3x usa a 1ª parcela (33334) e informa 66666 futuros", () => {
    const result = simulatePurchase({
      ...base,
      purchaseCents: 100000,
      installmentsTotal: 3,
    });

    expect(result.installmentsTotal).toBe(3);
    expect(result.installmentCents).toBe(33334);
    expect(result.futureCommitmentCents).toBe(66666);
    const data = buildPurchaseData({
      ...base,
      purchaseCents: 100000,
      installmentsTotal: 3,
    });
    expect(data.impactPerDayCents).toBe(4167);
    expect(plain(result.installmentLabel)).toBe(
      "Parcela de R$ 333,34 em 3 vezes; 2 parcelas restantes somam R$ 666,66 de compromisso futuro.",
    );
  });

  it("primeira parcela é floor(valor/N) + resto", () => {
    const data = buildPurchaseData({
      ...base,
      purchaseCents: 100000,
      installmentsTotal: 3,
    });

    expect(data.installmentCents).toBe(
      Math.floor(100000 / 3) + (100000 % 3),
    );
    expect(data.futureCommitmentCents).toBe(66666);
  });

  it.each([0, -2, 2.7, null])(
    "installmentsTotal %s normaliza para 1 no núcleo",
    (installmentsTotal) => {
      const result = simulatePurchase({
        ...base,
        purchaseCents: 80000,
        installmentsTotal,
      });

      expect(result.installmentsTotal).toBe(1);
      expect(result.installmentCents).toBe(80000);
      expect(result.futureCommitmentCents).toBe(0);
    },
  );
});

describe("simulatePurchase — meta de economia", () => {
  it("sem meta ou meta zerada não altera o veredito", () => {
    const semMeta = simulatePurchase({ ...base, purchaseCents: 20000 });
    const metaNula = simulatePurchase({
      ...base,
      purchaseCents: 20000,
      savingsGoalCents: null,
    });
    const metaZero = simulatePurchase({
      ...base,
      purchaseCents: 20000,
      savingsGoalCents: 0,
    });

    expect(semMeta.verdict).toBe("ok");
    expect(metaNula).toEqual(semMeta);
    expect(metaZero).toEqual(semMeta);
    expect(metaZero.goalLabel).toBe("Sem meta de economia definida.");
  });

  it("meta atingida mantém o veredito e sinaliza atingida", () => {
    const semMeta = simulatePurchase({ ...base, purchaseCents: 20000 });
    const atingida = simulatePurchase({
      ...base,
      purchaseCents: 20000,
      savingsGoalCents: 100000,
      savingsGoalSavedCents: 100000,
    });

    expect(atingida.verdict).toBe(semMeta.verdict);
    expect(atingida.goalLabel).toBe("Meta de economia atingida.");
  });

  it("1ª parcela ≥ restante da meta força nao", () => {
    const result = simulatePurchase({
      ...base,
      purchaseCents: 200000,
      installmentsTotal: 10,
      savingsGoalCents: 20000,
      savingsGoalSavedCents: 0,
    });

    expect(result.installmentCents).toBe(20000);
    expect(result.verdict).toBe("nao");
  });

  it("1ª parcela × 2 ≥ restante força no mínimo cuidado", () => {
    const result = simulatePurchase({
      ...base,
      purchaseCents: 20000,
      savingsGoalCents: 40000,
      savingsGoalSavedCents: 0,
    });

    expect(result.verdict).toBe("cuidado");
    expect(plain(result.goalLabel)).toBe(
      "Faltam R$ 400,00 para a meta de R$ 400,00 (0% guardado).",
    );
  });

  it("nunca melhora um veredito já negativo", () => {
    const result = simulatePurchase({
      ...base,
      purchaseCents: 160000,
      savingsGoalCents: 1000000,
      savingsGoalSavedCents: 0,
    });

    expect(result.verdict).toBe("nao");
  });

  it("exibe o restante e o percentual guardado", () => {
    const result = simulatePurchase({
      ...base,
      purchaseCents: 10000,
      savingsGoalCents: 100000,
      savingsGoalSavedCents: 25000,
    });

    expect(plain(result.goalLabel)).toBe(
      "Faltam R$ 750,00 para a meta de R$ 1.000,00 (25% guardado).",
    );
  });
});

describe("buildPurchaseData", () => {
  it("expõe apenas números do impacto", () => {
    const data = buildPurchaseData({ ...base, purchaseCents: 80000 });

    expect(data.freeBudgetCents).toBe(200000);
    expect(data.dailyCents).toBe(25000);
    expect(data.remainingDays).toBe(8);
    expect(data.usualDailySpendCents).toBe(20000);
    expect(data.purchaseCents).toBe(80000);
    expect(data.installmentsTotal).toBe(1);
    expect(data.installmentCents).toBe(80000);
    expect(data.futureCommitmentCents).toBe(0);
    expect(data.impactPerDayCents).toBe(10000);
    expect(data.newFreeBudgetCents).toBe(120000);
    expect(data.newDailyCents).toBe(15000);
  });

  it("explica parcelamento e meta com números", () => {
    const data = buildPurchaseData({
      ...base,
      purchaseCents: 100000,
      installmentsTotal: 3,
      savingsGoalCents: 100000,
      savingsGoalSavedCents: 25000,
    });

    expect(data.installmentsTotal).toBe(3);
    expect(data.installmentCents).toBe(33334);
    expect(data.futureCommitmentCents).toBe(66666);
    expect(data.savingsGoalCents).toBe(100000);
    expect(data.savingsGoalSavedCents).toBe(25000);
    expect(data.goalRemainingCents).toBe(75000);
  });

  it("zera a meta sem meta ou atingida", () => {
    const semMeta = buildPurchaseData({ ...base, purchaseCents: 10000 });
    const atingida = buildPurchaseData({
      ...base,
      purchaseCents: 10000,
      savingsGoalCents: 100000,
      savingsGoalSavedCents: 100000,
    });

    expect(semMeta.savingsGoalCents).toBe(0);
    expect(semMeta.savingsGoalSavedCents).toBe(0);
    expect(semMeta.goalRemainingCents).toBe(0);
    expect(atingida.savingsGoalCents).toBe(0);
    expect(atingida.savingsGoalSavedCents).toBe(0);
    expect(atingida.goalRemainingCents).toBe(0);
  });

  it("não inclui rótulos, descrições ou qualquer string", () => {
    const data = buildPurchaseData({ ...base, purchaseCents: 80000 }) as Record<
      string,
      unknown
    >;

    for (const [key, value] of Object.entries(data)) {
      expect(typeof value, key).toBe("number");
    }
    expect(Object.values(data).some((value) => typeof value === "string")).toBe(
      false,
    );
  });
});

describe("buildPurchasePrompt — privacidade", () => {
  it("envia apenas números no conteúdo do usuário", () => {
    const messages = buildPurchasePrompt(
      { ...base, purchaseCents: 30000 },
      "ok",
    );
    const userMessage = messages.find((message) => message.role === "user");
    const parsed = JSON.parse(userMessage?.content ?? "{}") as Record<
      string,
      unknown
    >;

    for (const value of Object.values(parsed)) {
      expect(typeof value).toBe("number");
    }
  });

  it("cita o veredito local no system prompt", () => {
    const messages = buildPurchasePrompt(
      { ...base, purchaseCents: 30000 },
      "cuidado",
    );
    const system = messages.find((message) => message.role === "system");

    expect(system?.content).toContain(VERDICT_LABELS.cuidado);
  });

  it("cita parcelamento e meta (quando há meta) no system prompt", () => {
    const comMeta = buildPurchasePrompt(
      {
        ...base,
        purchaseCents: 100000,
        installmentsTotal: 3,
        savingsGoalCents: 100000,
        savingsGoalSavedCents: 25000,
      },
      "ok",
    );
    const comMetaSystem = comMeta.find((message) => message.role === "system");
    expect(comMetaSystem?.content).toContain("installmentCents");
    expect(comMetaSystem?.content).toContain("installmentsTotal");
    expect(comMetaSystem?.content).toContain("meta de economia");

    const semMeta = buildPurchasePrompt(
      { ...base, purchaseCents: 100000, installmentsTotal: 3 },
      "ok",
    );
    const semMetaSystem = semMeta.find((message) => message.role === "system");
    expect(semMetaSystem?.content).toContain("installmentCents");
    expect(semMetaSystem?.content).not.toContain("meta de economia");
  });
});

describe("integração com o ritmo do ciclo (fatura no ritmo)", () => {
  it("a fatura do mês endurece o veredito de uma compra que caberia", () => {
    // Regressão do sintoma "R$ 10,42 por dia": sem a fatura no ritmo, a compra
    // passava como "Pode comprar"; com a fatura (consumo real), vira "nao".
    const semFatura = usualDailySpendCents({
      variableSpentCents: 24000,
      cardExpensesCents: 0,
      elapsedDays: 25,
    });
    const comFatura = usualDailySpendCents({
      variableSpentCents: 24000,
      cardExpensesCents: 600000,
      elapsedDays: 25,
    });

    expect(semFatura).toBe(960);
    expect(comFatura).toBe(24960);

    const purchase = {
      freeBudgetCents: 500000,
      dailyCents: 20000,
      remainingDays: 25,
      purchaseCents: 300000,
    };

    expect(
      simulatePurchase({ ...purchase, usualDailySpendCents: semFatura }).verdict,
    ).toBe("ok");
    expect(
      simulatePurchase({ ...purchase, usualDailySpendCents: comFatura }).verdict,
    ).toBe("nao");
  });
});
