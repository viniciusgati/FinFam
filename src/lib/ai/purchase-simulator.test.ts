import { describe, expect, it } from "vitest";
import {
  buildPurchaseData,
  buildPurchasePrompt,
  VERDICT_LABELS,
  simulatePurchase,
} from "./purchase-simulator";

const base = {
  incomeCents: 100000,
  spentCents: 20000,
  elapsedDay: 10,
  daysInMonth: 30,
};

describe("simulatePurchase — faixas", () => {
  it("ok quando a compra cabe em até metade do saldo", () => {
    const result = simulatePurchase({ ...base, purchaseCents: 30000 });
    expect(result.verdict).toBe("ok");
    expect(result.label).toBe(VERDICT_LABELS.ok);
  });

  it("cuidado quando passa de metade mas cabe no saldo", () => {
    const result = simulatePurchase({ ...base, purchaseCents: 50000 });
    expect(result.verdict).toBe("cuidado");
  });

  it("nao quando excede o saldo restante", () => {
    const result = simulatePurchase({ ...base, purchaseCents: 90000 });
    expect(result.verdict).toBe("nao");
  });

  it("nao quando o saldo é zero e a compra é positiva", () => {
    const result = simulatePurchase({
      ...base,
      incomeCents: 10000,
      spentCents: 10000,
      purchaseCents: 1,
    });
    expect(result.verdict).toBe("nao");
  });
});

describe("simulatePurchase — justificativa", () => {
  it("não cita média sem histórico", () => {
    const result = simulatePurchase({ ...base, purchaseCents: 30000 });
    expect(result.summary.toLowerCase()).not.toContain("média");
  });

  it("cita a média quando há histórico", () => {
    const result = simulatePurchase({
      ...base,
      purchaseCents: 30000,
      previousMonthsCents: [50000, 70000],
    });
    expect(result.summary).toContain("média");
    expect(result.summary).toContain("2 meses");
  });
});

describe("buildPurchasePrompt — privacidade", () => {
  it("envia apenas números no conteúdo do usuário", () => {
    const messages = buildPurchasePrompt(
      { ...base, purchaseCents: 30000, previousMonthsCents: [1000] },
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

  it("buildPurchaseData expõe o saldo restante", () => {
    const data = buildPurchaseData({ ...base, purchaseCents: 30000 });
    expect(data.remainingCents).toBe(80000);
    expect(data.previousMonthsCount).toBe(0);
  });
});
