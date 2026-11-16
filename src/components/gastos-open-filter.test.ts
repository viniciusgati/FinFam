import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Guarda o filtro rápido `status=open` de `/gastos` (história #364): a página
 * lê o `status` da URL e o manager filtra client-side sobre o mês já carregado,
 * sem perder o filtro ao editar uma linha. O comportamento das funções puras
 * vive em `src/lib/open-expenses.test.ts`; aqui só o wiring (sem test runner
 * de DOM).
 */

function readSource(relativePath: string): string {
  return readFileSync(
    fileURLToPath(new URL(relativePath, import.meta.url)),
    "utf8",
  );
}

describe("filtro rápido de gastos em aberto", () => {
  it("a página lê status=open e repassa initialStatus ao manager", () => {
    const page = readSource("../app/(app)/gastos/page.tsx");

    expect(page).toContain("status?: string | string[]");
    expect(page).toContain('rawStatus === "open" ? "open" : undefined');
    expect(page).toContain("initialStatus={status}");
  });

  it("o manager deriva o resumo do mês da lista completa e filtra a exibida", () => {
    const source = readSource("./GastosManager.tsx");

    expect(source).toContain("filterByStatus(expenses, \"open\")");
    expect(source).toContain("openMonthSummaryText(openSummary)");
    expect(source).toContain(
      "filterByStatus(expenses, initialStatus)",
    );
    expect(source).toContain("Mostrando somente gastos em aberto");
    expect(source).toContain("openExpensesEmptyText(monthName)");
    expect(source).toContain("Ver todos os gastos");
  });
});
