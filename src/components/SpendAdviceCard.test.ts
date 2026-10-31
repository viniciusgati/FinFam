import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { buildSpendAdvice } from "@/lib/spend-advice";
import SpendAdviceCard from "./SpendAdviceCard";

function render(
  overrides: Partial<Parameters<typeof buildSpendAdvice>[0]> = {},
): string {
  const advice = buildSpendAdvice({
    windowDays: 30,
    elapsedDays: 10,
    incomeCents: 300000,
    fixedExpensesCents: 90000,
    variableConsumedCents: 98000,
    isCurrentCycle: true,
    ...overrides,
  });

  if (advice === null) return "";
  return renderToStaticMarkup(
    createElement(SpendAdviceCard, { advice }),
  ).replace(/\u00a0/g, " ");
}

describe("SpendAdviceCard (renderização)", () => {
  it("mostra o alerta adiantado em âmbar com role=status", () => {
    const html = render();

    expect(html).toContain(
      "Segure o consumo por 4 dias para se manter dentro do necessário.",
    );
    expect(html).toContain("bg-amber-950");
    expect(html).toContain("text-amber-100");
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
  });

  it("mostra o no ritmo em verde", () => {
    const html = render({ variableConsumedCents: 70000 });

    expect(html).toContain(
      "No ritmo esperado: continue assim para fechar o ciclo dentro do orçamento.",
    );
    expect(html).toContain("bg-emerald-950");
    expect(html).toContain("text-emerald-100");
  });

  it("mostra o estouro em vermelho com role=alert", () => {
    const html = render({ variableConsumedCents: 220000 });

    expect(html).toContain("Orçamento variável do ciclo estourado");
    expect(html).toContain("bg-red-950");
    expect(html).toContain("text-red-200");
    expect(html).toContain('role="alert"');
    expect(html).toContain('aria-live="assertive"');
  });

  it("não renderiza nada quando o motor devolve null", () => {
    expect(render({ isCurrentCycle: false })).toBe("");
    expect(render({ elapsedDays: 0 })).toBe("");
  });
});
