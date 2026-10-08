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
    countdownLabel: "8 dias para o fim do ciclo",
    feedback: "Você está gastando abaixo do esperado.",
    ...overrides,
  };
  return renderToStaticMarkup(createElement(MonthSpendCard, props));
}

describe("MonthSpendCard (renderização)", () => {
  it("mantém todo o conteúdo do hero: percentual, nível, vencimento e contador do ciclo", () => {
    const html = render();

    expect(html).toContain("Renda do mês consumida");
    expect(html).toContain("42");
    expect(html).toContain("Ok");
    expect(html).toContain("Vencimento da fatura em 10/04");
    expect(html).toContain("Mês calendário");
    expect(html).toContain("8 dias para o fim do ciclo");
    expect(html).not.toContain("fim do mês");
  });

  it("renderiza exatamente o rótulo do contador recebido", () => {
    const lastDay = render({
      countdownLabel: "Hoje é o último dia do ciclo",
    });

    expect(lastDay).toContain("Hoje é o último dia do ciclo");
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

  it("mostra a projeção e o risco quando a projeção estoura a renda", () => {
    const html = render({ projectedPercent: 248, projectedRisk: true });

    expect(html).toContain("No ritmo atual: 248% até o fim do mês");
    expect(html).toContain("Risco de estouro");
  });

  it("mostra a projeção sem risco quando abaixo de 100%", () => {
    const html = render({ projectedPercent: 90, projectedRisk: false });

    expect(html).toContain("No ritmo atual: 90% até o fim do mês");
    expect(html).not.toContain("Risco de estouro");
  });

  it("não mostra projeção quando projectedPercent está ausente", () => {
    const html = render();

    expect(html).not.toContain("No ritmo atual");
  });

  it("expõe o risco em role=status com aria-live=polite", () => {
    const html = render({ projectedPercent: 248, projectedRisk: true });

    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
  });
});
