import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import MonthSpendCard from "./MonthSpendCard";

function render(overrides: Partial<Parameters<typeof MonthSpendCard>[0]> = {}) {
  const props = {
    backgroundColor: "hsl(150 40% 40%)",
    percent: 42,
    level: "green" as const,
    invoiceDue: "Vencimento da fatura em 10/04",
    daysRemaining: 7,
    feedback: "Você está gastando abaixo do esperado.",
    ...overrides,
  };
  return renderToStaticMarkup(createElement(MonthSpendCard, props));
}

describe("MonthSpendCard (renderização)", () => {
  it("mantém todo o conteúdo do hero: percentual, nível, vencimento e dias", () => {
    const html = render();

    expect(html).toContain("Renda do mês consumida");
    expect(html).toContain("42");
    expect(html).toContain("Ok");
    expect(html).toContain("Vencimento da fatura em 10/04");
    expect(html).toContain("7 dias para o fim do mês");
  });

  it("aplica as classes compactas de tipografia e padding", () => {
    const html = render();

    expect(html).toContain("p-6");
    expect(html).toContain("text-5xl");
    expect(html).toContain("sm:text-7xl");
  });

  it("expõe o feedback em role=status com aria-live=polite", () => {
    const html = render();

    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain("Você está gastando abaixo do esperado.");
  });

  it("renderiza o nível do mês", () => {
    const html = render({ level: "orange" });

    expect(html).toContain("Alerta");
  });

  it("aceita className extra (ex.: md:col-span-2)", () => {
    const html = render({ className: "md:col-span-2" });

    expect(html).toContain("md:col-span-2");
  });
});
