import { describe, expect, it } from "vitest";
import {
  buildFutureCommitments,
  FUTURE_COMMITMENT_MONTHS,
} from "./future-commitments";
import type { CardPurchaseRecord } from "./invoices";

const card = (id: string, name: string, dueDay = 10) => ({
  id,
  name,
  closingDay: 20,
  dueDay,
});

const purchase = (
  overrides: Partial<CardPurchaseRecord> & {
    card?: CardPurchaseRecord["card"];
  } = {},
): CardPurchaseRecord => ({
  id: "p1",
  description: "Compra",
  purchaseDate: new Date(Date.UTC(2026, 10, 5, 12)), // 05/11/2026
  amountCents: 10000,
  installmentsTotal: 3,
  card: card("c1", "Nubank"),
  ...overrides,
});

describe("buildFutureCommitments", () => {
  it("projeta exatamente os 3 meses seguintes ao mês-base", () => {
    expect(FUTURE_COMMITMENT_MONTHS).toBe(3);

    expect(
      buildFutureCommitments([], "2026-11").map((month) => month.monthKey),
    ).toEqual(["2026-12", "2027-01", "2027-02"]);
  });

  it("recorta a janela: 0 vira 1 mês e 99 vira 3 meses", () => {
    expect(
      buildFutureCommitments([], "2026-11", 0).map((month) => month.monthKey),
    ).toEqual(["2026-12"]);
    expect(
      buildFutureCommitments([], "2026-11", 99).map((month) => month.monthKey),
    ).toEqual(["2026-12", "2027-01", "2027-02"]);
  });

  it("rateia 10000 em 3x como 3334/3333/3333 (resto na 1ª parcela)", () => {
    const months = buildFutureCommitments([purchase()], "2026-11");

    expect(months.map((month) => month.totalCents)).toEqual([
      3334, 3333, 3333,
    ]);
    expect(months[0].cards).toEqual([
      { cardId: "c1", cardName: "Nubank", amountCents: 3334 },
    ]);
    expect(months.reduce((sum, month) => sum + month.totalCents, 0)).toBe(
      10000,
    );
  });

  it("não inclui parcela além do 3º mês da janela", () => {
    const months = buildFutureCommitments(
      [purchase({ installmentsTotal: 4, amountCents: 4000 })],
      "2026-11",
    );

    expect(months.map((month) => month.monthKey)).toEqual([
      "2026-12",
      "2027-01",
      "2027-02",
    ]);
    expect(months.map((month) => month.totalCents)).toEqual([1000, 1000, 1000]);
    expect(months.some((month) => month.monthKey === "2027-03")).toBe(false);
  });

  it("mostra mês sem parcelas com total zero e nenhum cartão", () => {
    const months = buildFutureCommitments(
      [purchase({ installmentsTotal: 1 })],
      "2026-11",
    );

    expect(months[0].totalCents).toBe(10000);
    expect(months[1]).toEqual({
      monthKey: "2027-01",
      totalCents: 0,
      cards: [],
    });
  });

  it("agrega por cartão, ignora valor zero e ordena por nome", () => {
    const months = buildFutureCommitments(
      [
        purchase({ id: "p1", card: card("c1", "Nubank") }),
        purchase({
          id: "p2",
          amountCents: 5000,
          installmentsTotal: 1,
          card: card("c2", "Itaú"),
        }),
        purchase({
          id: "p3",
          amountCents: 0,
          installmentsTotal: 1,
          card: card("c3", "C6"),
        }),
      ],
      "2026-11",
    );

    expect(months[0].cards).toEqual([
      { cardId: "c2", cardName: "Itaú", amountCents: 5000 },
      { cardId: "c1", cardName: "Nubank", amountCents: 3334 },
    ]);
    expect(months[0].totalCents).toBe(8334);
  });

  it("soma parcelas de cartões diferentes no total do mês", () => {
    const months = buildFutureCommitments(
      [
        purchase({ id: "p1", amountCents: 3000, installmentsTotal: 3 }),
        purchase({
          id: "p2",
          amountCents: 6000,
          installmentsTotal: 3,
          card: card("c2", "Itaú"),
        }),
      ],
      "2026-11",
    );

    expect(months.map((month) => month.totalCents)).toEqual([
      3000, 3000, 3000,
    ]);
  });
});
