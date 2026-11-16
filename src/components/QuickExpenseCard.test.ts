import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import QuickExpenseCard from "./QuickExpenseCard";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

const CARDS = [
  { id: "1", name: "Nubank" },
  { id: "2", name: "Inter" },
];

function render(
  props: Partial<Parameters<typeof QuickExpenseCard>[0]> = {},
): string {
  return renderToStaticMarkup(
    createElement(QuickExpenseCard, props),
  ).replace(/\u00a0/g, " ");
}

function readSource(relativePath: string): string {
  return readFileSync(
    fileURLToPath(new URL(relativePath, import.meta.url)),
    "utf8",
  );
}

describe("QuickExpenseCard (renderização)", () => {
  it("mostra a forma de pagamento com PIX e os cartões ativos", () => {
    const html = render({ cards: CARDS });

    expect(html).toContain("Forma de pagamento");
    expect(html).toContain("Dinheiro/PIX (já pago)");
    expect(html).toContain("Nubank");
    expect(html).toContain("Inter");
    expect(html).toContain('value="pix" selected=""');
  });

  it("começa em PIX e exibe o aviso de lançamento já pago", () => {
    const html = render({ cards: CARDS });

    expect(html).toContain("Este lançamento já nasce marcado como pago.");
  });

  it("sem cartões ativos mostra apenas PIX e não quebra", () => {
    const html = render({ cards: [] });

    expect(html).toContain("Dinheiro/PIX (já pago)");
    expect(html).not.toContain("Nubank");
    expect(html).not.toContain("Inter");
    expect(html).toContain("Este lançamento já nasce marcado como pago.");
  });
});

/**
 * O submit só existe após interação (o projeto não tem test runner de DOM),
 * então o endpoint de cada meio de pagamento e os feedbacks são verificados
 * no fonte do componente — mesmo padrão de `PurchaseSimulator.test.ts` e
 * `SettingsForm.test.ts`. As mensagens exatas ficam cobertas em
 * `src/lib/quick-expense.test.ts`.
 */
describe("QuickExpenseCard (fluxo de envio)", () => {
  it("oculta o aviso de pago quando um cartão está selecionado", () => {
    const source = readSource("./QuickExpenseCard.tsx");

    expect(source).toContain('payment === PIX_OPTION ? (');
    expect(source).toContain("Este lançamento já nasce marcado como pago.");
  });

  it("envia PIX para /api/variable-expenses e cartão para /api/card-purchases", () => {
    const source = readSource("./QuickExpenseCard.tsx");

    expect(source).toContain("buildQuickExpensePayload");
    expect(source).toContain("buildQuickCardPurchasePayload");
    expect(source).toContain('"/api/variable-expenses"');
    expect(source).toContain('"/api/card-purchases"');
    expect(source).toContain("quickExpenseSuccessMessage(target)");
  });

  it("exibe o 400 do cartão em role=status sem limpar os campos", () => {
    const source = readSource("./QuickExpenseCard.tsx");

    expect(source).toContain("quickExpenseApiError(body)");
    expect(source).toContain('role="status"');
    expect(source).toContain("setFeedback({ kind: \"error\", message })");
    expect(source).toContain("mapQuickExpenseFieldErrors(body?.fieldErrors)");
    expect(source).toContain("NETWORK_ERROR_MESSAGE");
  });

  it("desabilita o botão e mostra Salvando... durante o envio", () => {
    const source = readSource("./QuickExpenseCard.tsx");

    expect(source).toContain("disabled={submitting}");
    expect(source).toContain('submitting ? "Salvando..." : "Salvar"');
  });
});
