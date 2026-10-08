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

describe("buildPurchaseData", () => {
  it("expõe apenas números do impacto", () => {
    const data = buildPurchaseData({ ...base, purchaseCents: 80000 });

    expect(data.freeBudgetCents).toBe(200000);
    expect(data.dailyCents).toBe(25000);
    expect(data.remainingDays).toBe(8);
    expect(data.usualDailySpendCents).toBe(20000);
    expect(data.purchaseCents).toBe(80000);
    expect(data.impactPerDayCents).toBe(10000);
    expect(data.newFreeBudgetCents).toBe(120000);
    expect(data.newDailyCents).toBe(15000);
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
