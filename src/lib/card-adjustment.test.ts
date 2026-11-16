import { describe, expect, it } from "vitest";
import {
  CARD_AMOUNT_ERROR,
  CARD_NETWORK_ERROR,
  CARD_SELECTION_ERROR,
  buildCardAdjustmentPayload,
  cardAdjustmentFeedback,
  invoiceMonthKeyForCycle,
  invoiceTotalsByCard,
  validateCardAdjustment,
} from "./card-adjustment";
import type { CardPurchaseRecord } from "./invoices";

const nbsp = (value: string) => value.replace(/\u00a0/g, " ");

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

describe("invoiceMonthKeyForCycle", () => {
  it("com início do ciclo no dia 1 usa o próprio mês do ciclo", () => {
    expect(invoiceMonthKeyForCycle("2026-11", 1)).toBe("2026-11");
  });

  it("nos demais dias usa o mês seguinte ao do ciclo", () => {
    expect(invoiceMonthKeyForCycle("2026-11", 15)).toBe("2026-12");
  });

  it("vira o ano corretamente", () => {
    expect(invoiceMonthKeyForCycle("2026-12", 15)).toBe("2027-01");
  });
});

describe("invoiceTotalsByCard", () => {
  const purchases: CardPurchaseRecord[] = [
    // c1: 2 parcelas de 500,00; competem em março e abril (fechamento 20, venc. 5).
    purchase({
      id: "p1",
      purchaseDate: new Date(Date.UTC(2026, 1, 10, 12)),
      amountCents: 100000,
      installmentsTotal: 2,
    }),
    // c2: compra de fevereiro com vencimento em março.
    purchase({
      id: "p2",
      purchaseDate: new Date(Date.UTC(2026, 1, 10, 12)),
      amountCents: 30000,
      card: { id: "c2", name: "Inter", closingDay: 20, dueDay: 5 },
    }),
    // c1: compra de janeiro que compete em fevereiro, não em março.
    purchase({
      id: "p3",
      purchaseDate: new Date(Date.UTC(2026, 0, 10, 12)),
      amountCents: 99900,
    }),
  ];

  it("agrupa as parcelas pela competência do mês-alvo", () => {
    expect(invoiceTotalsByCard(purchases, "2026-03")).toEqual({
      c1: 50000,
      c2: 30000,
    });
  });

  it("compra de outro mês não contamina o total", () => {
    // Fevereiro recebe a compra de janeiro (c1) e a 1ª parcela seria em março.
    expect(invoiceTotalsByCard(purchases, "2026-02")).toEqual({ c1: 99900 });
  });

  it("mês sem lançamentos devolve mapa vazio (tratado como R$ 0,00)", () => {
    expect(invoiceTotalsByCard(purchases, "2026-05")).toEqual({});
  });

  it("cartão sem lançamentos fica ausente do mapa", () => {
    expect(invoiceTotalsByCard(purchases, "2026-05").c2).toBeUndefined();
  });
});

describe("validateCardAdjustment", () => {
  it("sem cartão devolve erro de seleção e total nulo", () => {
    expect(validateCardAdjustment({ cardId: "", amount: "12,34" })).toEqual({
      cardId: null,
      totalCents: null,
      error: CARD_SELECTION_ERROR,
    });
    expect(CARD_SELECTION_ERROR).toBe("Selecione um cartão");
  });

  it("com cartão e valor vazio, zero ou inválido devolve erro de valor", () => {
    for (const amount of ["", "0", "1,234"]) {
      expect(validateCardAdjustment({ cardId: "c1", amount })).toEqual({
        cardId: "c1",
        totalCents: null,
        error: CARD_AMOUNT_ERROR,
      });
    }
    expect(CARD_AMOUNT_ERROR).toBe("Informe um valor maior que zero");
  });

  it("aceita valor pt-BR válido e converte para centavos", () => {
    expect(validateCardAdjustment({ cardId: "c1", amount: "12,34" })).toEqual({
      cardId: "c1",
      totalCents: 1234,
      error: null,
    });
    expect(
      validateCardAdjustment({ cardId: "c1", amount: "1.234,56" }),
    ).toEqual({ cardId: "c1", totalCents: 123456, error: null });
  });
});

describe("buildCardAdjustmentPayload", () => {
  it("monta o payload do set-total com o mês informado", () => {
    expect(
      buildCardAdjustmentPayload({
        cardId: "c1",
        amount: "1.234,56",
        monthKey: "2026-12",
      }),
    ).toEqual({ cardId: "c1", monthKey: "2026-12", totalCents: 123456 });
  });

  it("devolve null para entrada inválida", () => {
    expect(
      buildCardAdjustmentPayload({
        cardId: "",
        amount: "12,34",
        monthKey: "2026-12",
      }),
    ).toBeNull();
    expect(
      buildCardAdjustmentPayload({
        cardId: "c1",
        amount: "0",
        monthKey: "2026-12",
      }),
    ).toBeNull();
  });
});

describe("cardAdjustmentFeedback", () => {
  it("201 informa a diferença criada e o novo total", () => {
    const message = cardAdjustmentFeedback({
      status: "created",
      diffCents: 25000,
      totalCents: 100000,
    });
    expect(nbsp(message)).toBe(
      "Ajuste criado: R$ 250,00. Fatura agora soma R$ 1.000,00",
    );
  });

  it("200 informa que a fatura já está no valor", () => {
    const message = cardAdjustmentFeedback({
      status: "no-op",
      totalCents: 100000,
    });
    expect(nbsp(message)).toBe(
      "A fatura já está no valor informado (R$ 1.000,00)",
    );
  });

  it("400 devolve a mensagem de erro da API", () => {
    const apiError =
      "O total-alvo (R$ 500,00) é menor que o total já lançado (R$ 600,00). Para corrigir para baixo, exclua/edite lançamentos existentes.";
    expect(cardAdjustmentFeedback({ status: "below", error: apiError })).toBe(
      apiError,
    );
  });

  it("falha de rede devolve a mensagem padrão", () => {
    expect(cardAdjustmentFeedback({ status: "network" })).toBe(
      CARD_NETWORK_ERROR,
    );
    expect(CARD_NETWORK_ERROR).toBe(
      "Não foi possível ajustar a fatura. Tente novamente.",
    );
  });
});
