import { describe, expect, it } from "vitest";
import {
  NO_CATEGORY_FILTER,
  filterExpenses,
  normalizeSearchTerm,
  sumExpenseAmounts,
  type FilterableExpense,
} from "./expense-filters";

function expense(
  id: string,
  overrides: Partial<FilterableExpense> = {},
): FilterableExpense & { id: string } {
  return {
    id,
    description: "Gasto",
    amountCents: 1000,
    category: null,
    paymentMethod: "PIX",
    paid: false,
    ...overrides,
  };
}

const MERCADO = expense("mercado", {
  description: "Mercado São João",
  amountCents: 12990,
  category: "Alimentação",
  paymentMethod: "PIX",
  paid: false,
});

const FEIRA = expense("feira", {
  description: "Feira do bairro",
  amountCents: 4500,
  category: "Alimentação",
  paymentMethod: "CASH",
  paid: true,
});

const FARMACIA = expense("farmacia", {
  description: "Farmácia Central",
  amountCents: 2350,
  category: null,
  paymentMethod: "DEBIT",
  paid: true,
});

const POSTO = expense("posto", {
  description: "Posto BR",
  amountCents: 20000,
  category: "Transporte",
  paymentMethod: "CREDIT",
  paid: false,
});

const ITEMS = [MERCADO, FEIRA, FARMACIA, POSTO];

describe("normalizeSearchTerm", () => {
  it("remove acentos, ignora caixa e colapsa espaços", () => {
    expect(normalizeSearchTerm("  São   JOÃO ")).toBe("sao joao");
    expect(normalizeSearchTerm("Alimentação")).toBe("alimentacao");
  });

  it("devolve string vazia para vazio, só espaços, null ou undefined", () => {
    expect(normalizeSearchTerm("")).toBe("");
    expect(normalizeSearchTerm("   ")).toBe("");
    expect(normalizeSearchTerm(null)).toBe("");
    expect(normalizeSearchTerm(undefined)).toBe("");
  });
});

describe("filterExpenses — sem filtros", () => {
  it("devolve a mesma lista quando os filtros estão ausentes/vazios", () => {
    expect(filterExpenses(ITEMS)).toBe(ITEMS);
    expect(filterExpenses(ITEMS, {})).toBe(ITEMS);
    expect(
      filterExpenses(ITEMS, {
        q: "",
        category: null,
        payment: null,
        status: null,
      }),
    ).toBe(ITEMS);
    expect(filterExpenses(ITEMS, { q: "   " })).toBe(ITEMS);
  });

  it("ignora filtros desconhecidos ou inválidos sem erro", () => {
    expect(
      filterExpenses(ITEMS, {
        payment: "BOLETO",
        status: "pending",
      }),
    ).toBe(ITEMS);
  });
});

describe("filterExpenses — busca por descrição", () => {
  it("faz substring case-insensível e acento-insensível", () => {
    expect(filterExpenses(ITEMS, { q: "merc" })).toEqual([MERCADO]);
    expect(filterExpenses(ITEMS, { q: "MERCADO" })).toEqual([MERCADO]);
    expect(filterExpenses(ITEMS, { q: "sao joao" })).toEqual([MERCADO]);
    expect(filterExpenses(ITEMS, { q: "SÃO   JOÃO" })).toEqual([MERCADO]);
    expect(filterExpenses(ITEMS, { q: "farmacia" })).toEqual([FARMACIA]);
    expect(filterExpenses(ITEMS, { q: "FARMÁCIA" })).toEqual([FARMACIA]);
  });

  it("busca vazia ou só espaços não filtra", () => {
    expect(filterExpenses(ITEMS, { q: "" })).toBe(ITEMS);
    expect(filterExpenses(ITEMS, { q: "    " })).toBe(ITEMS);
  });

  it("devolve lista vazia quando nenhuma descrição casa", () => {
    expect(filterExpenses(ITEMS, { q: "inexistente" })).toEqual([]);
  });
});

describe("filterExpenses — categoria", () => {
  it("compara o rótulo normalizado ignorando caixa", () => {
    expect(filterExpenses(ITEMS, { category: "alimentação" })).toEqual([
      MERCADO,
      FEIRA,
    ]);
    expect(filterExpenses(ITEMS, { category: "ALIMENTAÇÃO" })).toEqual([
      MERCADO,
      FEIRA,
    ]);
    expect(filterExpenses(ITEMS, { category: "Alimentação" })).toEqual([
      MERCADO,
      FEIRA,
    ]);
  });

  it("preserva acentos: Alimentacao não casa com Alimentação", () => {
    expect(filterExpenses(ITEMS, { category: "Alimentacao" })).toEqual([]);
  });

  it("__none__ casa apenas gastos sem categoria", () => {
    expect(filterExpenses(ITEMS, { category: NO_CATEGORY_FILTER })).toEqual([
      FARMACIA,
    ]);
  });

  it("categoria ausente/vazia não filtra", () => {
    expect(filterExpenses(ITEMS, { category: null })).toBe(ITEMS);
    expect(filterExpenses(ITEMS, { category: "" })).toBe(ITEMS);
    expect(filterExpenses(ITEMS, { category: "   " })).toBe(ITEMS);
  });
});

describe("filterExpenses — forma de pagamento e status", () => {
  it("forma de pagamento compara o valor exato do enum", () => {
    expect(filterExpenses(ITEMS, { payment: "PIX" })).toEqual([MERCADO]);
    expect(filterExpenses(ITEMS, { payment: "CREDIT" })).toEqual([POSTO]);
    expect(filterExpenses(ITEMS, { payment: "pix" })).toBe(ITEMS);
  });

  it("status open devolve não pagos e paid devolve pagos", () => {
    expect(filterExpenses(ITEMS, { status: "open" })).toEqual([MERCADO, POSTO]);
    expect(filterExpenses(ITEMS, { status: "paid" })).toEqual([FEIRA, FARMACIA]);
  });

  it("status inválido não filtra", () => {
    expect(filterExpenses(ITEMS, { status: "em-aberto" })).toBe(ITEMS);
  });
});

describe("filterExpenses — combinações e ordem", () => {
  it("combina todos os filtros com AND", () => {
    expect(
      filterExpenses(ITEMS, {
        q: "merc",
        category: "Alimentação",
        payment: "PIX",
        status: "open",
      }),
    ).toEqual([MERCADO]);
  });

  it("um filtro sem correspondência zera a interseção", () => {
    expect(
      filterExpenses(ITEMS, {
        category: "Alimentação",
        payment: "DEBIT",
      }),
    ).toEqual([]);
  });

  it("preserva a ordem recebida", () => {
    expect(
      filterExpenses(ITEMS, { status: "open" }).map((item) => item.id),
    ).toEqual(["mercado", "posto"]);
  });
});

describe("sumExpenseAmounts", () => {
  it("soma os valores da lista visível", () => {
    expect(
      sumExpenseAmounts(filterExpenses(ITEMS, { status: "open" })),
    ).toBe(32990);
  });

  it("lista vazia soma zero", () => {
    expect(sumExpenseAmounts([])).toBe(0);
    expect(sumExpenseAmounts(filterExpenses(ITEMS, { q: "nada" }))).toBe(0);
  });
});
