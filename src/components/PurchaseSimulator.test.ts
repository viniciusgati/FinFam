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

  it("não valida nada antes de digitar (sem mensagem de erro no estado inicial)", () => {
    const html = render();

    expect(html).not.toContain("Informe um valor maior que zero");
    expect(html).not.toContain("Não foi possível simular");
  });

  it("aceita usualDailySpendCents nulo (sem ritmo medido)", () => {
    const html = render({ usualDailySpendCents: null });

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
    expect(source).toContain('disabled={invalid || status === "loading"}');
  });
});
