import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { openCycleSummaryText } from "@/lib/open-expenses";
import OpenExpensesCard from "./OpenExpensesCard";

function render(
  summary: { totalCents: number; count: number },
  emptyLabel?: string,
): string {
  return renderToStaticMarkup(
    createElement(OpenExpensesCard, { summary, emptyLabel }),
  ).replace(/\u00a0/g, " ");
}

describe("OpenExpensesCard (renderização)", () => {
  it("mostra o título A pagar, o resumo do ciclo e o link filtrado", () => {
    const summary = { totalCents: 12050, count: 2 };
    const html = render(summary);

    expect(html).toContain("A pagar");
    expect(html).toContain(openCycleSummaryText(summary).replace(/\u00a0/g, " "));
    expect(html).toContain('href="/gastos?status=open"');
    expect(html).toContain("Ver gastos em aberto");
  });

  it("com zero em aberto mantém a linha exata e o link", () => {
    const html = render({ totalCents: 0, count: 0 });

    expect(html).toContain("A pagar no ciclo: R$ 0,00 · Nenhum gasto em aberto");
    expect(html).toContain('href="/gastos?status=open"');
  });

  it("ao zerar exibe o vazio 'Nenhum gasto em aberto em <mês> de <ano>.' (regressão #373)", () => {
    const html = render({ totalCents: 0, count: 0 }, "novembro de 2026");

    expect(html).toContain(
      "Nenhum gasto em aberto em novembro de 2026.",
    );
  });

  it("não exibe o vazio do mês enquanto há gastos em aberto", () => {
    const html = render({ totalCents: 12050, count: 2 }, "novembro de 2026");

    expect(html).not.toContain("Nenhum gasto em aberto em novembro de 2026.");
  });

  it("a página do dashboard passa o mês do ciclo para o vazio do card", () => {
    const page = readFileSync(
      fileURLToPath(new URL("../app/(app)/page.tsx", import.meta.url)),
      "utf8",
    );

    expect(page).toContain("emptyLabel={monthLabel(referenceMonthKey)}");
  });
});
