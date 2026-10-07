import { describe, expect, it } from "vitest";
import {
  cardPurchaseCreateSchema,
  cardPurchaseUpdateSchema,
  creditCardCreateSchema,
  creditCardUpdateSchema,
  invoiceSetTotalSchema,
} from "./validation";

const validCard = {
  name: "Nubank",
  closingDay: 20,
  dueDay: 5,
};

const validPurchase = {
  cardId: "card-1",
  description: "Notebook",
  amountCents: 300000,
  purchaseDate: "2026-11-15",
  installmentNumber: 1,
  installmentsTotal: 3,
};

describe("creditCardCreateSchema", () => {
  it("aceita cartão válido e aplica active=true por padrão", () => {
    const parsed = creditCardCreateSchema.safeParse(validCard);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.active).toBe(true);
      expect(parsed.data.limitCents).toBeUndefined();
    }
  });

  it("aceita limite positivo e limite nulo", () => {
    expect(
      creditCardCreateSchema.safeParse({ ...validCard, limitCents: 500000 })
        .success,
    ).toBe(true);
    expect(
      creditCardCreateSchema.safeParse({ ...validCard, limitCents: null }).success,
    ).toBe(true);
  });

  it("rejeita nome vazio, limite não positivo e dias fora de 1–31", () => {
    expect(creditCardCreateSchema.safeParse({ ...validCard, name: "  " }).success).toBe(
      false,
    );
    expect(
      creditCardCreateSchema.safeParse({ ...validCard, limitCents: 0 }).success,
    ).toBe(false);
    expect(
      creditCardCreateSchema.safeParse({ ...validCard, closingDay: 0 }).success,
    ).toBe(false);
    expect(
      creditCardCreateSchema.safeParse({ ...validCard, dueDay: 32 }).success,
    ).toBe(false);
  });
});

describe("creditCardUpdateSchema", () => {
  it("aceita edição parcial", () => {
    expect(creditCardUpdateSchema.safeParse({ active: false }).success).toBe(true);
    expect(creditCardUpdateSchema.safeParse({ closingDay: 15 }).success).toBe(true);
  });

  it("rejeita dia inválido em edição parcial", () => {
    expect(creditCardUpdateSchema.safeParse({ closingDay: 40 }).success).toBe(false);
  });
});

describe("cardPurchaseCreateSchema", () => {
  it("aceita compra válida convertendo purchaseDate em Date", () => {
    const parsed = cardPurchaseCreateSchema.safeParse(validPurchase);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.purchaseDate).toBeInstanceOf(Date);
    }
  });

  it("rejeita cardId/descrição vazios, valor ≤ 0 e data ausente", () => {
    expect(
      cardPurchaseCreateSchema.safeParse({ ...validPurchase, cardId: "" }).success,
    ).toBe(false);
    expect(
      cardPurchaseCreateSchema.safeParse({ ...validPurchase, description: "   " })
        .success,
    ).toBe(false);
    expect(
      cardPurchaseCreateSchema.safeParse({ ...validPurchase, amountCents: 0 })
        .success,
    ).toBe(false);
    expect(
      cardPurchaseCreateSchema.safeParse({ ...validPurchase, purchaseDate: "  " })
        .success,
    ).toBe(false);
  });

  it("rejeita parcela maior que o total e parcelas abaixo de 1", () => {
    expect(
      cardPurchaseCreateSchema.safeParse({
        ...validPurchase,
        installmentNumber: 4,
        installmentsTotal: 3,
      }).success,
    ).toBe(false);
    expect(
      cardPurchaseCreateSchema.safeParse({
        ...validPurchase,
        installmentNumber: 0,
      }).success,
    ).toBe(false);
    expect(
      cardPurchaseCreateSchema.safeParse({
        ...validPurchase,
        installmentsTotal: 0,
      }).success,
    ).toBe(false);
  });
});

describe("cardPurchaseUpdateSchema", () => {
  it("aceita edição parcial", () => {
    expect(
      cardPurchaseUpdateSchema.safeParse({ description: "Mouse" }).success,
    ).toBe(true);
  });

  it("rejeita parcela > total no próprio payload", () => {
    expect(
      cardPurchaseUpdateSchema.safeParse({
        installmentNumber: 5,
        installmentsTotal: 2,
      }).success,
    ).toBe(false);
  });
});

describe("invoiceSetTotalSchema", () => {
  const validInput = { cardId: "card-1", monthKey: "2026-03", totalCents: 75000 };

  it("aceita payload válido", () => {
    expect(invoiceSetTotalSchema.safeParse(validInput).success).toBe(true);
  });

  it("rejeita cardId vazio, monthKey inválido e totalCents <= 0", () => {
    expect(
      invoiceSetTotalSchema.safeParse({ ...validInput, cardId: "  " }).success,
    ).toBe(false);
    expect(
      invoiceSetTotalSchema.safeParse({ ...validInput, monthKey: "2026-13" })
        .success,
    ).toBe(false);
    expect(
      invoiceSetTotalSchema.safeParse({ ...validInput, totalCents: 0 }).success,
    ).toBe(false);
    expect(
      invoiceSetTotalSchema.safeParse({ ...validInput, totalCents: 1.5 }).success,
    ).toBe(false);
  });
});
