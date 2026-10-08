import { describe, expect, it } from "vitest";
import {
  buildCategoryBreakdown,
  categoryBreakdownView,
  type CategoryBreakdownInput,
} from "./category-breakdown";

const MONTH = "2026-10";

function input(
  overrides: Partial<CategoryBreakdownInput> = {},
): CategoryBreakdownInput {
  return {
    monthKey: MONTH,
    fixedExpenses: [],
    variableExpenses: [],
    cardPurchases: [],
    ...overrides,
  };
}

function normalize(value: string): string {
  return value.replace(/\u00a0/g, " ");
}

describe("buildCategoryBreakdown", () => {
  it("agrupa fixa, avulso e parcela de cartão em uma fatia por categoria", () => {
    const breakdown = buildCategoryBreakdown(
      input({
        fixedExpenses: [
          {
            amountCents: 10000,
            category: "Moradia",
            active: true,
            startMonth: null,
            endMonth: null,
          },
        ],
        variableExpenses: [
          { amountCents: 5000, category: "Mercado", paymentMethod: "PIX" },
        ],
        cardPurchases: [
          {
            purchaseDate: new Date(Date.UTC(2026, 8, 10, 12)),
            amountCents: 6000,
            installmentsTotal: 1,
            category: "Lazer",
            card: { closingDay: 20, dueDay: 5 },
          },
        ],
      }),
    );

    expect(breakdown.monthKey).toBe(MONTH);
    expect(breakdown.items).toEqual([
      { category: "Moradia", amountCents: 10000 },
      { category: "Lazer", amountCents: 6000 },
      { category: "Mercado", amountCents: 5000 },
    ]);
    expect(breakdown.totalCents).toBe(21000);
    expect(breakdown.totalCents).toBe(
      breakdown.items.reduce((total, item) => total + item.amountCents, 0),
    );
  });

  it("ignora saída fixa fora da vigência e avulso CREDIT", () => {
    const breakdown = buildCategoryBreakdown(
      input({
        fixedExpenses: [
          {
            amountCents: 9900,
            category: "Moradia",
            active: true,
            startMonth: "2026-11",
            endMonth: null,
          },
          {
            amountCents: 8800,
            category: "Moradia",
            active: false,
            startMonth: null,
            endMonth: null,
          },
        ],
        variableExpenses: [
          { amountCents: 7777, category: "Cartão", paymentMethod: "CREDIT" },
          { amountCents: 1000, category: "Mercado", paymentMethod: "DEBIT" },
        ],
      }),
    );

    expect(breakdown.items).toEqual([{ category: "Mercado", amountCents: 1000 }]);
  });

  it("junta variantes de caixa/espaços e agrupa vazios em Sem categoria", () => {
    const breakdown = buildCategoryBreakdown(
      input({
        fixedExpenses: [
          {
            amountCents: 1000,
            category: "mercado",
            active: true,
            startMonth: null,
            endMonth: null,
          },
          {
            amountCents: 2000,
            category: null,
            active: true,
            startMonth: null,
            endMonth: null,
          },
        ],
        variableExpenses: [
          { amountCents: 3000, category: "Mercado ", paymentMethod: "PIX" },
          { amountCents: 4000, category: "", paymentMethod: "CASH" },
        ],
        cardPurchases: [
          {
            purchaseDate: new Date(Date.UTC(2026, 8, 10, 12)),
            amountCents: 5000,
            installmentsTotal: 1,
            category: "  mercado",
            card: { closingDay: 20, dueDay: 5 },
          },
          {
            purchaseDate: new Date(Date.UTC(2026, 8, 10, 12)),
            amountCents: 6000,
            installmentsTotal: 1,
            category: "   ",
            card: { closingDay: 20, dueDay: 5 },
          },
        ],
      }),
    );

    expect(breakdown.items).toEqual([
      { category: "Sem categoria", amountCents: 12000 },
      { category: "mercado", amountCents: 9000 },
    ]);
  });

  it("reconstrói o valor integral da compra em 3x pela competência (resto na 1ª)", () => {
    const purchase = {
      purchaseDate: new Date(Date.UTC(2026, 8, 10, 12)),
      amountCents: 10000,
      installmentsTotal: 3,
      category: "Lazer",
      card: { closingDay: 20, dueDay: 5 },
    };

    // Compra 10/09 com fechamento 20 / vencimento 5 → competências 10, 11 e 12.
    const amounts = ["2026-10", "2026-11", "2026-12"].map((monthKey) => {
      const breakdown = buildCategoryBreakdown(
        input({ monthKey, cardPurchases: [purchase] }),
      );
      return breakdown.items[0]?.amountCents ?? 0;
    });

    expect(amounts).toEqual([3334, 3333, 3333]);
    expect(amounts.reduce((total, amount) => total + amount, 0)).toBe(10000);
  });

  it("não conta a compra inteira no mês da compra (regressão)", () => {
    // Compra feita em 15/10 com fechamento no dia 10 → ciclo 2026-11 e
    // competência 2026-12. Não pode aparecer nem integralmente em outubro.
    const purchase = {
      purchaseDate: new Date(Date.UTC(2026, 9, 15, 12)),
      amountCents: 30000,
      installmentsTotal: 3,
      category: "Lazer",
      card: { closingDay: 10, dueDay: 5 },
    };

    const outubro = buildCategoryBreakdown(
      input({ monthKey: "2026-10", cardPurchases: [purchase] }),
    );
    expect(outubro.items).toEqual([]);
    expect(outubro.totalCents).toBe(0);

    // Cada uma das 3 competências recebe só a sua parcela (resto na 1ª).
    const parcelas = ["2026-12", "2027-01", "2027-02"].map((monthKey) => {
      const breakdown = buildCategoryBreakdown(
        input({ monthKey, cardPurchases: [purchase] }),
      );
      return [breakdown.items[0]?.amountCents, breakdown.totalCents];
    });
    expect(parcelas).toEqual([
      [10000, 10000],
      [10000, 10000],
      [10000, 10000],
    ]);
  });

  it("desempata valores iguais por localeCompare(pt-BR) ascendente", () => {
    const breakdown = buildCategoryBreakdown(
      input({
        variableExpenses: [
          { amountCents: 5000, category: "Aluguel", paymentMethod: "PIX" },
          { amountCents: 5000, category: "Alimentação", paymentMethod: "PIX" },
          { amountCents: 5000, category: null, paymentMethod: "PIX" },
        ],
      }),
    );

    expect(breakdown.items.map((item) => item.category)).toEqual([
      "Alimentação",
      "Aluguel",
      "Sem categoria",
    ]);
  });

  it("a soma das fatias reconstrói fixas + avulsos + cartão", () => {
    const breakdown = buildCategoryBreakdown(
      input({
        fixedExpenses: [
          {
            amountCents: 120000,
            category: "Moradia",
            active: true,
            startMonth: null,
            endMonth: null,
          },
        ],
        variableExpenses: [
          { amountCents: 6000, category: "Mercado", paymentMethod: "CASH" },
        ],
        cardPurchases: [
          {
            purchaseDate: new Date(Date.UTC(2026, 8, 10, 12)),
            amountCents: 60000,
            installmentsTotal: 1,
            category: "Lazer",
            card: { closingDay: 20, dueDay: 5 },
          },
        ],
      }),
    );

    expect(breakdown.totalCents).toBe(186000);
    expect(breakdown.totalCents).toBe(120000 + 6000 + 60000);
  });
});

describe("categoryBreakdownView", () => {
  it("monta os rótulos exatos dos itens e do total", () => {
    const view = categoryBreakdownView(
      buildCategoryBreakdown(
        input({
          variableExpenses: [
            { amountCents: 123456, category: "Mercado", paymentMethod: "PIX" },
            { amountCents: 500, category: "Padaria", paymentMethod: "CASH" },
          ],
        }),
      ),
    );

    expect(view.title).toBe("Gastos por categoria");
    expect(view.itemLabels.map(normalize)).toEqual([
      "Mercado — R$ 1.234,56",
      "Padaria — R$ 5,00",
    ]);
    expect(normalize(view.totalLabel)).toBe("Total — R$ 1.239,56");
    expect(view.isEmpty).toBe(false);
  });

  it("expõe a cópia do estado vazio", () => {
    const view = categoryBreakdownView(buildCategoryBreakdown(input()));

    expect(view.isEmpty).toBe(true);
    expect(view.itemLabels).toEqual([]);
    expect(normalize(view.totalLabel)).toBe("Total — R$ 0,00");
    expect(view.emptyMessage).toBe("Nenhum gasto por categoria neste mês");
    expect(view.emptyCtaLabel).toBe("Registrar gastos");
    expect(view.emptyCtaHref).toBe("/gastos");
    expect(view.slices).toEqual([]);
    expect(view.ariaLabel).toBe(
      "Gastos por categoria: nenhum gasto neste mês",
    );
  });

  it("monta as slices na ordem da agregação com R$ e percentuais que somam 100", () => {
    const view = categoryBreakdownView(
      buildCategoryBreakdown(
        input({
          fixedExpenses: [
            {
              amountCents: 120000,
              category: "Moradia",
              active: true,
              startMonth: null,
              endMonth: null,
            },
          ],
          variableExpenses: [
            { amountCents: 6000, category: "Mercado", paymentMethod: "PIX" },
          ],
        }),
      ),
    );

    expect(
      view.slices.map((slice) => ({
        ...slice,
        amountLabel: normalize(slice.amountLabel),
      })),
    ).toEqual([
      {
        category: "Moradia",
        amountCents: 120000,
        amountLabel: "R$ 1.200,00",
        percent: 95,
      },
      {
        category: "Mercado",
        amountCents: 6000,
        amountLabel: "R$ 60,00",
        percent: 5,
      },
    ]);
    expect(view.slices.reduce((total, slice) => total + slice.percent, 0)).toBe(
      100,
    );
  });

  it("distribui o resto do maior percentual e ainda fecha em 100", () => {
    const view = categoryBreakdownView(
      buildCategoryBreakdown(
        input({
          variableExpenses: [
            { amountCents: 100, category: "Aaa", paymentMethod: "PIX" },
            { amountCents: 100, category: "Bbb", paymentMethod: "PIX" },
            { amountCents: 100, category: "Ccc", paymentMethod: "PIX" },
          ],
        }),
      ),
    );

    expect(view.slices.map((slice) => slice.percent)).toEqual([34, 33, 33]);
    expect(view.slices.reduce((total, slice) => total + slice.percent, 0)).toBe(
      100,
    );
  });

  it("monta o aria-label exato do fixture", () => {
    const view = categoryBreakdownView(
      buildCategoryBreakdown(
        input({
          fixedExpenses: [
            {
              amountCents: 120000,
              category: "Moradia",
              active: true,
              startMonth: null,
              endMonth: null,
            },
          ],
          variableExpenses: [
            { amountCents: 6000, category: "Mercado", paymentMethod: "PIX" },
          ],
        }),
      ),
    );

    expect(normalize(view.ariaLabel)).toBe(
      "Gastos por categoria: Moradia R$ 1.200,00 (95%), Mercado R$ 60,00 (5%). Total R$ 1.260,00",
    );
  });
});
