import { describe, expect, it } from "vitest";
import {
  CLEAR_FILTERS_LABEL,
  NO_CATEGORY_FILTER,
  activeExpenseFilterChips,
  buildExpenseFilterQuery,
  canonicalSearchTerm,
  filteredExpensesEmptyText,
  filteredTotalText,
  filterExpenses,
  hasActiveExpenseFilters,
  monthTotalText,
  normalizeSearchTerm,
  parseExpenseFilters,
  removeExpenseFilter,
  sumExpenseAmounts,
  visibleExpensesCountText,
  type FilterableExpense,
} from "./expense-filters";

/** O `formatCents` usa espaço não separável; normaliza antes de comparar. */
function plain(value: string): string {
  return value.replace(/\u00a0/g, " ");
}

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

describe("canonicalSearchTerm", () => {
  it("faz trim e colapsa espaços preservando caixa e acentos", () => {
    expect(canonicalSearchTerm("  São   JOÃO ")).toBe("São JOÃO");
    expect(canonicalSearchTerm("mercado")).toBe("mercado");
  });

  it("devolve vazio para vazio, só espaços, null ou undefined", () => {
    expect(canonicalSearchTerm("")).toBe("");
    expect(canonicalSearchTerm("   ")).toBe("");
    expect(canonicalSearchTerm(null)).toBe("");
    expect(canonicalSearchTerm(undefined)).toBe("");
  });
});

describe("parseExpenseFilters", () => {
  it("lê os parâmetros válidos e ignora vazios", () => {
    expect(
      parseExpenseFilters({
        q: "  São   João ",
        categoria: " Alimentação ",
        pagamento: "PIX",
        status: "open",
      }),
    ).toEqual({
      q: "São João",
      category: "Alimentação",
      payment: "PIX",
      status: "open",
    });
  });

  it("ignora pagamento/status inválidos e q/categoria vazios", () => {
    expect(
      parseExpenseFilters({
        q: "   ",
        categoria: "  ",
        pagamento: "BOLETO",
        status: "pending",
      }),
    ).toEqual({
      q: null,
      category: null,
      payment: null,
      status: null,
    });
  });

  it("trata categoria=__none__ e usa o primeiro valor de arrays", () => {
    expect(
      parseExpenseFilters({
        q: ["mercado", "feira"],
        categoria: [NO_CATEGORY_FILTER, "Alimentação"],
        pagamento: ["CREDIT", "PIX"],
        status: ["paid", "open"],
      }),
    ).toEqual({
      q: "mercado",
      category: NO_CATEGORY_FILTER,
      payment: "CREDIT",
      status: "paid",
    });
  });

  it("é tolerante a searchParams ausentes", () => {
    expect(parseExpenseFilters()).toEqual({
      q: null,
      category: null,
      payment: null,
      status: null,
    });
  });
});

describe("buildExpenseFilterQuery", () => {
  it("inclui mes e só filtros válidos, com q canonicalizado", () => {
    expect(
      buildExpenseFilterQuery("2026-11", {
        q: "  merc   do mês ",
        category: "Alimentação",
        payment: "PIX",
        status: "open",
      }),
    ).toBe(
      "mes=2026-11&q=merc+do+m%C3%AAs&categoria=Alimenta%C3%A7%C3%A3o&pagamento=PIX&status=open",
    );
  });

  it("omite filtros vazios ou inválidos e mantém mes", () => {
    expect(
      buildExpenseFilterQuery("2026-11", {
        q: "   ",
        category: "",
        payment: "BOLETO",
        status: "pending",
      }),
    ).toBe("mes=2026-11");
    expect(buildExpenseFilterQuery("2026-11")).toBe("mes=2026-11");
  });

  it("faz round-trip com o parse preservando mes e filtros", () => {
    const filters = {
      q: "Mercado",
      category: NO_CATEGORY_FILTER,
      payment: "CREDIT" as const,
      status: "paid" as const,
    };
    const query = buildExpenseFilterQuery("2026-11", filters);
    const params = Object.fromEntries(new URLSearchParams(query));
    expect(params.mes).toBe("2026-11");
    expect(parseExpenseFilters(params)).toEqual(filters);
    expect(buildExpenseFilterQuery("2026-11", parseExpenseFilters(params))).toBe(
      query,
    );
  });
});

describe("removeExpenseFilter", () => {
  it("remove somente o campo indicado", () => {
    const filters = {
      q: "merc",
      category: "Alimentação",
      payment: "PIX",
      status: "open",
    };
    expect(removeExpenseFilter(filters, "payment")).toEqual({
      q: "merc",
      category: "Alimentação",
      payment: null,
      status: "open",
    });
  });
});

describe("chips de filtros ativos", () => {
  it("monta os chips na ordem q, categoria, pagamento, status", () => {
    expect(
      activeExpenseFilterChips({
        q: "  merc   do mês ",
        category: "Alimentação",
        payment: "PIX",
        status: "open",
      }),
    ).toEqual([
      { key: "q", label: 'Descrição: "merc do mês"' },
      { key: "category", label: "Categoria: Alimentação" },
      { key: "payment", label: "Pagamento: PIX" },
      { key: "status", label: "Status: Em aberto" },
    ]);
  });

  it("usa rótulos exatos por filtro", () => {
    expect(
      activeExpenseFilterChips({ category: NO_CATEGORY_FILTER }).map(
        (chip) => chip.label,
      ),
    ).toEqual(["Categoria: Sem categoria"]);
    expect(
      activeExpenseFilterChips({ payment: "CREDIT" }).map((chip) => chip.label),
    ).toEqual(["Pagamento: Crédito"]);
    expect(
      activeExpenseFilterChips({ status: "paid" }).map((chip) => chip.label),
    ).toEqual(["Status: Pago"]);
  });

  it("não monta chip para filtros vazios ou inválidos", () => {
    expect(activeExpenseFilterChips({})).toEqual([]);
    expect(
      activeExpenseFilterChips({
        q: "   ",
        category: "",
        payment: "BOLETO",
        status: "pending",
      }),
    ).toEqual([]);
  });
});

describe("hasActiveExpenseFilters", () => {
  it("indica se há ao menos um filtro válido", () => {
    expect(hasActiveExpenseFilters()).toBe(false);
    expect(hasActiveExpenseFilters({ q: "   " })).toBe(false);
    expect(hasActiveExpenseFilters({ status: "open" })).toBe(true);
  });
});

describe("textos de total e estado vazio", () => {
  it("monta o total do mês", () => {
    expect(plain(monthTotalText(123456))).toBe("Total do mês: R$ 1.234,56");
  });

  it("monta o total filtrado com a contagem", () => {
    expect(plain(filteredTotalText(12000, 3, 12))).toBe(
      "Total filtrado: R$ 120,00 · 3 de 12 gastos",
    );
    expect(plain(filteredTotalText(0, 0, 12))).toBe(
      "Total filtrado: R$ 0,00 · 0 de 12 gastos",
    );
  });

  it("resume a contagem visível", () => {
    expect(visibleExpensesCountText(0, 12)).toBe("0 de 12 gastos");
    expect(visibleExpensesCountText(12, 12)).toBe("12 de 12 gastos");
  });

  it("monta o empty state de filtros e o rótulo de limpar", () => {
    expect(filteredExpensesEmptyText("novembro de 2026")).toBe(
      "Nenhum gasto para os filtros selecionados em novembro de 2026.",
    );
    expect(CLEAR_FILTERS_LABEL).toBe("Limpar filtros");
  });
});
