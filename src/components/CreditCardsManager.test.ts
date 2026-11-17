import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import CreditCardsManager, {
  type CardPurchaseData,
  type CreditCardData,
} from "./CreditCardsManager";

const CARD: CreditCardData = {
  id: "c1",
  name: "Cartão principal",
  limitCents: 200000,
  closingDay: 20,
  dueDay: 5,
  active: true,
};

const PURCHASE: CardPurchaseData = {
  id: "p1",
  cardId: "c1",
  description: "Supermercado",
  amountCents: 60000,
  purchaseDate: "2026-11-08",
  category: "Alimentação",
  installmentNumber: 1,
  installmentsTotal: 1,
  card: {
    id: "c1",
    name: "Cartão principal",
    closingDay: 20,
    dueDay: 5,
  },
};

function render(
  cards: CreditCardData[] = [CARD],
  referenceMonthKey = "2026-12",
): string {
  return renderToStaticMarkup(
    createElement(CreditCardsManager, {
      initialCards: cards,
      initialPurchases: [PURCHASE],
      referenceMonthKey,
    }),
  ).replace(/\u00a0/g, " ");
}

describe("CreditCardsManager (limite disponível)", () => {
  it("exibe limite disponível = limite − fatura da competência (regressão #373)", () => {
    const html = render();

    expect(html).toContain("Limite R$ 2.000,00");
    expect(html).toContain("Limite disponível R$ 1.400,00");
  });

  it("sem limite cadastrado continua exibindo 'Sem limite'", () => {
    const html = render([{ ...CARD, limitCents: null }]);

    expect(html).toContain(" · Sem limite");
    expect(html).not.toContain("· Limite disponível");
  });

  it("competência sem parcelas mantém o limite integral disponível", () => {
    const html = render([CARD], "2026-11");

    expect(html).toContain("Limite disponível R$ 2.000,00");
  });
});
