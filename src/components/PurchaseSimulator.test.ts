import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import PurchaseSimulator from "./PurchaseSimulator";

function render(
  overrides: Partial<Parameters<typeof PurchaseSimulator>[0]> = {},
): string {
  const props = {
    freeBudgetCents: 500000,
    dailyCents: 20000,
    remainingDays: 25,
    usualDailySpendCents: 24960,
    ...overrides,
  };
  return renderToStaticMarkup(createElement(PurchaseSimulator, props));
}

function readSource(relativePath: string): string {
  return readFileSync(
    fileURLToPath(new URL(relativePath, import.meta.url)),
    "utf8",
  );
}

describe("PurchaseSimulator (renderização)", () => {
  it("mostra o formulário e explica o critério do poder de compra", () => {
    const html = render();

    expect(html).toContain("Posso comprar?");
    expect(html).toContain("poder de compra por dia");
    expect(html).toContain('aria-label="Valor da compra em reais"');
    expect(html).toContain("Simular");
  });

  it("mostra o campo de parcelas com valor inicial 1", () => {
    const html = render();

    expect(html).toContain("Número de parcelas");
    expect(html).toContain('aria-label="Número de parcelas"');
    expect(html).toContain('value="1"');
  });

  it("não valida nada antes de digitar (sem mensagem de erro no estado inicial)", () => {
    const html = render();

    expect(html).not.toContain("Informe um valor maior que zero");
    expect(html).not.toContain(
      "Informe um número de parcelas maior ou igual a 1",
    );
    expect(html).not.toContain("Não foi possível simular");
    expect(html).not.toContain("Parcela de");
    expect(html).not.toContain("Sem meta de economia definida.");
  });

  it("aceita usualDailySpendCents nulo (sem ritmo medido)", () => {
    const html = render({ usualDailySpendCents: null });

    expect(html).toContain("Posso comprar?");
  });

  it("aceita as props opcionais de meta", () => {
    const html = render({
      savingsGoalCents: 100000,
      savingsGoalSavedCents: 25000,
    });

    expect(html).toContain("Posso comprar?");
  });
});

/**
 * O resultado só existe após interação (sem test runner de DOM), então a
 * fonte do veredito e os feedbacks são verificados no fonte do componente —
 * mesmo padrão de `dashboard-layout.test.ts`.
 */
describe("PurchaseSimulator (fonte do veredito e feedbacks)", () => {
  it("propaga source e avisa quando o veredito é local", () => {
    const source = readSource("./PurchaseSimulator.tsx");

    expect(source).toContain('source: "ai" | "local"');
    expect(source).toContain('result.source === "local"');
    expect(source).toContain("Resultado calculado localmente, sem IA.");
    expect(source).toContain('role="status"');
    expect(source).toContain('aria-live="polite"');
  });

  it("mantém os feedbacks de simulação", () => {
    const source = readSource("./PurchaseSimulator.tsx");

    expect(source).toContain("Consultando…");
    expect(source).toContain("Simular");
    expect(source).toContain("Informe um valor maior que zero");
    expect(source).toContain("Não foi possível simular agora. Tente novamente.");
    expect(source).toContain('role="alert"');
    expect(source).toContain(
      "disabled={invalid || installmentsInvalid || status === \"loading\"}",
    );
  });

  it("valida as parcelas inline com aria-invalid", () => {
    const source = readSource("./PurchaseSimulator.tsx");

    expect(source).toContain(
      "Informe um número de parcelas maior ou igual a 1",
    );
    expect(source).toContain('aria-label="Número de parcelas"');
    expect(source).toContain("aria-invalid={showInstallmentsValidation}");
  });

  it("envia parcelas e meta no corpo do POST", () => {
    const source = readSource("./PurchaseSimulator.tsx");

    expect(source).toContain("installmentsTotal");
    expect(source).toContain("savingsGoalCents");
    expect(source).toContain("savingsGoalSavedCents");
    expect(source).toContain("body: JSON.stringify(input)");
  });

  it("exibe veredito, impacto, parcelamento, meta e resumo nesta ordem", () => {
    const source = readSource("./PurchaseSimulator.tsx");

    const order = [
      "{VERDICT_LABELS[result.verdict]}",
      "{result.impactLabel}",
      "{result.installmentLabel}",
      "{result.goalLabel}",
      "{result.summary}",
    ].map((needle) => source.indexOf(needle));

    expect(order.every((index) => index >= 0)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it("aplica uma classe de cor por veredito", () => {
    const source = readSource("./PurchaseSimulator.tsx");

    expect(source).toContain("border-emerald-700 bg-emerald-950 text-emerald-200");
    expect(source).toContain("border-amber-700 bg-amber-950 text-amber-200");
    expect(source).toContain("border-red-700 bg-red-950 text-red-200");
  });
});
