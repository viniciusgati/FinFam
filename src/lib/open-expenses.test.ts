import { describe, expect, it } from "vitest";
import {
  filterByStatus,
  monthWindow,
  openCycleSummaryText,
  openExpenseCountLabel,
  openExpensesEmptyText,
  openMonthSummaryText,
  setExpensePaid,
  sumOpenExpenses,
  type OpenExpenseItem,
} from "./open-expenses";

/** Normaliza o espaço não separável do `formatCents` antes de comparar. */
function plain(text: string): string {
  return text.replace(/\u00a0/g, " ");
}

const WINDOW = { from: "2026-11-01T00:00:00.000Z", to: "2026-12-01T00:00:00.000Z" };

function item(
  id: string,
  amountCents: number,
  date: string,
  paid = false,
): OpenExpenseItem {
  return { id, amountCents, date, paid };
}

describe("sumOpenExpenses", () => {
  it("lista vazia retorna zero", () => {
    expect(sumOpenExpenses([], WINDOW)).toEqual({ totalCents: 0, count: 0 });
  });

  it("ignora gastos já pagos", () => {
    const items = [
      item("a", 1000, "2026-11-10T12:00:00.000Z", true),
      item("b", 2500, "2026-11-20T12:00:00.000Z", true),
    ];
    expect(sumOpenExpenses(items, WINDOW)).toEqual({ totalCents: 0, count: 0 });
  });

  it("soma e conta apenas os não pagos, incluindo gastos no crédito", () => {
    const cash = item("a", 1299, "2026-11-05T12:00:00.000Z");
    const credit: OpenExpenseItem & { paymentMethod: "CREDIT" } = {
      id: "b",
      amountCents: 4500,
      date: "2026-11-15T12:00:00.000Z",
      paid: false,
      paymentMethod: "CREDIT",
    };
    const paid = item("c", 900, "2026-11-25T12:00:00.000Z", true);

    expect(sumOpenExpenses([cash, credit, paid], WINDOW)).toEqual({
      totalCents: 5799,
      count: 2,
    });
  });

  it("inclui o limite inferior e exclui o superior de [from, to)", () => {
    const items = [
      item("from", 1000, WINDOW.from),
      item("inside", 2000, "2026-11-15T00:00:00.000Z"),
      item("to", 4000, WINDOW.to),
      item("before", 8000, "2026-10-31T23:59:59.999Z"),
    ];
    expect(sumOpenExpenses(items, WINDOW)).toEqual({
      totalCents: 3000,
      count: 2,
    });
  });
});

describe("monthWindow", () => {
  it("monta a janela semiaberta do mês no fuso informado", () => {
    expect(
      monthWindow(new Date("2026-11-15T12:00:00.000Z"), "America/Sao_Paulo"),
    ).toEqual({
      monthKey: "2026-11",
      from: "2026-11-01T03:00:00.000Z",
      to: "2026-12-01T03:00:00.000Z",
    });
  });

  it("o mesmo instante cai em meses diferentes conforme o fuso", () => {
    const reference = new Date("2026-11-01T01:00:00.000Z");
    const saoPaulo = monthWindow(reference, "America/Sao_Paulo");
    const utc = monthWindow(reference, "UTC");

    expect(saoPaulo.monthKey).toBe("2026-10");
    expect(utc.monthKey).toBe("2026-11");

    // 31/10 23:30Z ainda é outubro em São Paulo (UTC−3) e já é novembro em UTC:
    // entra na janela de outubro paulista e fica fora da janela de novembro UTC.
    const expense = item("x", 1500, "2026-10-31T23:30:00.000Z");
    expect(sumOpenExpenses([expense], saoPaulo)).toEqual({
      totalCents: 1500,
      count: 1,
    });
    expect(sumOpenExpenses([expense], utc)).toEqual({
      totalCents: 0,
      count: 0,
    });
  });
});

describe("filterByStatus", () => {
  const items = [
    item("a", 100, "2026-11-01T12:00:00.000Z", false),
    item("b", 200, "2026-11-02T12:00:00.000Z", true),
    item("c", 300, "2026-11-03T12:00:00.000Z", false),
  ];

  it("open devolve só os gastos em aberto", () => {
    expect(filterByStatus(items, "open").map((i) => i.id)).toEqual(["a", "c"]);
  });

  it("status ausente ou inválido devolve todos", () => {
    expect(filterByStatus(items, undefined)).toHaveLength(3);
    expect(filterByStatus(items, null)).toHaveLength(3);
    expect(filterByStatus(items, "paid")).toHaveLength(3);
  });
});

describe("setExpensePaid", () => {
  const items = [
    item("a", 100, "2026-11-01T12:00:00.000Z", false),
    item("b", 200, "2026-11-02T12:00:00.000Z", false),
  ];

  it("altera somente a linha alvo", () => {
    const updated = setExpensePaid(items, "b", true);
    expect(updated).toEqual([
      item("a", 100, "2026-11-01T12:00:00.000Z", false),
      item("b", 200, "2026-11-02T12:00:00.000Z", true),
    ]);
    expect(items[1].paid).toBe(false);
  });

  it("reverte a marcação e restaura o resumo original em caso de falha", () => {
    const before = sumOpenExpenses(items, WINDOW);
    const optimistic = setExpensePaid(items, "a", true);
    expect(sumOpenExpenses(optimistic, WINDOW)).toEqual({
      totalCents: 200,
      count: 1,
    });

    const reverted = setExpensePaid(optimistic, "a", false);
    expect(sumOpenExpenses(reverted, WINDOW)).toEqual(before);
  });
});

describe("textos", () => {
  it("rotula a contagem em pt-BR", () => {
    expect(openExpenseCountLabel(0)).toBe("Nenhum gasto em aberto");
    expect(openExpenseCountLabel(1)).toBe("1 gasto em aberto");
    expect(openExpenseCountLabel(4)).toBe("4 gastos em aberto");
  });

  it("monta a linha do ciclo", () => {
    expect(
      plain(openCycleSummaryText({ totalCents: 123456, count: 2 })),
    ).toBe("A pagar no ciclo: R$ 1.234,56 · 2 gastos em aberto");
    expect(plain(openCycleSummaryText({ totalCents: 0, count: 0 }))).toBe(
      "A pagar no ciclo: R$ 0,00 · Nenhum gasto em aberto",
    );
  });

  it("monta a linha do mês", () => {
    expect(plain(openMonthSummaryText({ totalCents: 1500, count: 1 }))).toBe(
      "A pagar no mês: R$ 15,00 · 1 gasto em aberto",
    );
  });

  it("monta o empty state do filtro", () => {
    expect(openExpensesEmptyText("novembro de 2026")).toBe(
      "Nenhum gasto em aberto em novembro de 2026.",
    );
  });
});
