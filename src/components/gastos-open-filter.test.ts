import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Guarda o filtro rápido `status=open` de `/gastos` (história #364) no novo
 * wiring de filtros da #368: a página lê os parâmetros válidos da URL e repassa
 * `initialFilters` ao manager, que filtra client-side sobre o mês já carregado
 * sem perder o filtro ao editar uma linha. O comportamento das funções puras
 * vive em `src/lib/expense-filters.test.ts` e `src/lib/open-expenses.test.ts`;
 * aqui só o wiring (sem test runner de DOM).
 */

function readSource(relativePath: string): string {
  return readFileSync(
    fileURLToPath(new URL(relativePath, import.meta.url)),
    "utf8",
  );
}

describe("filtro rápido de gastos em aberto", () => {
  it("a página lê os filtros da URL e repassa initialFilters ao manager", () => {
    const page = readSource("../app/(app)/gastos/page.tsx");

    expect(page).toContain("q?: string | string[]");
    expect(page).toContain("categoria?: string | string[]");
    expect(page).toContain("pagamento?: string | string[]");
    expect(page).toContain("status?: string | string[]");
    expect(page).toContain("parseExpenseFilters(params)");
    expect(page).toContain("initialFilters={initialFilters}");
  });

  it("o manager deriva o resumo do mês da lista completa e filtra a exibida", () => {
    const source = readSource("./GastosManager.tsx");

    expect(source).toContain("filterExpenses(withMarkingOpen(expenses, markingId), filters)");
    expect(source).toContain("openMonthSummaryText(openSummary)");
    expect(source).toContain("activeExpenseFilterChips(filters)");
    expect(source).toContain("filteredExpensesEmptyText(monthName)");
    expect(source).not.toContain("Mostrando somente gastos em aberto");
    expect(source).not.toContain("openExpensesEmptyText");
    expect(source).not.toContain("Ver todos os gastos");
  });

  it("sincroniza os filtros com a URL sem refetch", () => {
    const source = readSource("./GastosManager.tsx");

    expect(source).toContain("window.history.replaceState(");
    expect(source).toContain("buildExpenseFilterQuery(mes, filters)");
    expect(source).not.toContain("router.replace");
  });

  it("mantém a linha visível como Em aberto/Marcando... durante o PATCH", () => {
    const source = readSource("./GastosManager.tsx");

    expect(source).toContain("withMarkingOpen(expenses, markingId)");
    expect(source).toContain("!expense.paid || marking");
    expect(source).toContain('{marking ? "Marcando..." : "Marcar como pago"}');
    expect(source).toContain("aria-busy={marking}");
  });
});
