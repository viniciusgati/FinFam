import { describe, expect, it } from "vitest";
import {
  adjustmentPurchaseDate,
  computeInvoiceAdjustment,
} from "./invoice-adjustment";
import { allocateInstallments, type CardPurchaseRecord } from "./invoices";

const card = { id: "c1", name: "Nubank", closingDay: 20, dueDay: 5 };

function purchase(
  overrides: Partial<CardPurchaseRecord> & {
    purchaseDate: Date;
    amountCents: number;
  },
): CardPurchaseRecord {
  return {
    id: "p1",
    description: "Compra",
    category: null,
    installmentsTotal: 1,
    card: { id: "c1", name: "Nubank", closingDay: 20, dueDay: 5 },
    ...overrides,
  };
}

describe("computeInvoiceAdjustment", () => {
  it("soma apenas as parcelas do cartão informado no mês", () => {
    const purchases = [
      // Cartão c1: compra à vista em 10/02 → vence em março (closing 20, due 5).
      purchase({ purchaseDate: new Date(Date.UTC(2026, 1, 10, 12)), amountCents: 50000 }),
      // Cartão c2 (não conta): compra grande no mesmo mês.
      {
        ...purchase({ purchaseDate: new Date(Date.UTC(2026, 1, 10, 12)), amountCents: 999999 }),
        card: { id: "c2", name: "Itaú", closingDay: 20, dueDay: 5 },
      },
    ];

    const adjustment = computeInvoiceAdjustment(
      purchases,
      "c1",
      "2026-03",
      75000,
    );

    expect(adjustment.currentCents).toBe(50000);
    expect(adjustment.targetCents).toBe(75000);
    expect(adjustment.diffCents).toBe(25000);
  });

  it("diffCents é a diferença positiva quando o alvo é maior", () => {
    const purchases = [
      purchase({ purchaseDate: new Date(Date.UTC(2026, 1, 10, 12)), amountCents: 50000 }),
    ];

    const adjustment = computeInvoiceAdjustment(purchases, "c1", "2026-03", 75000);

    expect(adjustment.diffCents).toBe(25000);
    expect(adjustment.diffCents).toBeGreaterThan(0);
  });

  it("diffCents = 0 quando o alvo é igual ao total lançado", () => {
    const purchases = [
      purchase({ purchaseDate: new Date(Date.UTC(2026, 1, 10, 12)), amountCents: 50000 }),
    ];

    const adjustment = computeInvoiceAdjustment(purchases, "c1", "2026-03", 50000);

    expect(adjustment.diffCents).toBe(0);
  });

  it("diffCents é negativa quando o alvo é menor que o lançado", () => {
    const purchases = [
      purchase({ purchaseDate: new Date(Date.UTC(2026, 1, 10, 12)), amountCents: 75000 }),
    ];

    const adjustment = computeInvoiceAdjustment(purchases, "c1", "2026-03", 50000);

    expect(adjustment.diffCents).toBe(-25000);
  });

  it("mês sem parcelas do cartão retorna currentCents = 0", () => {
    const purchases = [
      purchase({ purchaseDate: new Date(Date.UTC(2026, 1, 10, 12)), amountCents: 50000 }),
    ];

    const adjustment = computeInvoiceAdjustment(purchases, "c1", "2026-04", 50000);

    expect(adjustment.currentCents).toBe(0);
    expect(adjustment.diffCents).toBe(50000);
  });
});

describe("adjustmentPurchaseDate", () => {
  it("parcela única compete exatamente em monthKey (fechamento 20, vencimento 5)", () => {
    const date = adjustmentPurchaseDate(card, "2026-04");

    const [installment] = allocateInstallments(
      { purchaseDate: date, amountCents: 25000, installmentsTotal: 1 },
      card.closingDay,
      card.dueDay,
    );

    expect(installment.installmentNumber).toBe(1);
    expect(installment.monthKey).toBe("2026-04");
    expect(installment.amountCents).toBe(25000);
  });

  it("quando dueDay <= closingDay, a compra volta um mês antes do alvo", () => {
    const date = adjustmentPurchaseDate({ closingDay: 20, dueDay: 5 }, "2026-04");
    expect(date.getUTCFullYear()).toBe(2026);
    expect(date.getUTCMonth()).toBe(2); // março (0-based)
  });

  it("quando dueDay > closingDay, a compra fica no próprio mês do alvo", () => {
    const date = adjustmentPurchaseDate({ closingDay: 20, dueDay: 25 }, "2026-04");

    const [installment] = allocateInstallments(
      { purchaseDate: date, amountCents: 1000, installmentsTotal: 1 },
      20,
      25,
    );

    expect(installment.monthKey).toBe("2026-04");
  });
});
