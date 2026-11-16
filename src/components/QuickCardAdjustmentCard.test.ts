import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import QuickCardAdjustmentCard from "./QuickCardAdjustmentCard";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

const CARDS = [
  { id: "card-inter", name: "Inter" },
  { id: "card-nubank", name: "Nubank" },
];

function render(
  overrides: Partial<Parameters<typeof QuickCardAdjustmentCard>[0]> = {},
): string {
  const props = {
    cards: CARDS,
    totalsByCard: { "card-inter": 123456, "card-nubank": 0 },
    monthKey: "2026-11",
    ...overrides,
  };
  return renderToStaticMarkup(createElement(QuickCardAdjustmentCard, props));
}

function readSource(relativePath: string): string {
  return readFileSync(
    fileURLToPath(new URL(relativePath, import.meta.url)),
    "utf8",
  );
}

function normalize(value: string): string {
  return value.replace(/\u00a0/g, " ");
}

describe("QuickCardAdjustmentCard (renderização)", () => {
  it("mostra o formulário do ajuste rápido com os rótulos esperados", () => {
    const html = render();

    expect(html).toContain("Ajuste rápido do cartão");
    expect(html).toContain("Cartão");
    expect(html).toContain("Valor atual");
    expect(html).toContain("Novo total (R$)");
    expect(html).toContain("Selecione um cartão");
    expect(html).toContain("Salvar");
  });

  it("lista apenas os cartões recebidos, na ordem do servidor", () => {
    const html = render();

    expect(html).toContain("Inter");
    expect(html).toContain("Nubank");
    expect(html.indexOf("Inter")).toBeLessThan(html.indexOf("Nubank"));
  });

  it("estado inicial sem cartão mostra Valor atual como — e nenhum erro", () => {
    const html = render();

    expect(normalize(html)).toContain("—");
    expect(html).not.toContain("Selecione um cartão</div>");
    expect(html).not.toContain("Informe um valor maior que zero");
    expect(html).not.toContain("Não foi possível ajustar a fatura");
    expect(html).not.toContain("Ajuste criado:");
    expect(html).not.toContain("A fatura já está no valor informado");
  });

  it("sem cartões ativos mostra o estado vazio e o link para /cartoes", () => {
    const html = render({ cards: [], totalsByCard: {} });

    expect(html).toContain(
      "Nenhum cartão ativo. Cadastre um cartão para ajustar a fatura.",
    );
    expect(html).toContain('href="/cartoes"');
    expect(html).not.toContain("<select");
    expect(html).not.toContain("Salvar");
  });
});

/**
 * Sem test runner de DOM, os textos de feedback/erro e o estado de envio são
 * verificados na fonte do componente (padrão de `PurchaseSimulator.test.ts`) e
 * na lib pura que centraliza as mensagens.
 */
describe("QuickCardAdjustmentCard (fonte do envio e feedbacks)", () => {
  it("envia para a rota de set-total e atualiza o dashboard", () => {
    const source = readSource("./QuickCardAdjustmentCard.tsx");

    expect(source).toContain('"/api/card-invoices/set-total"');
    expect(source).toContain("router.refresh()");
    expect(source).toContain("JSON.stringify(");
    expect(source).toContain("cardId");
    expect(source).toContain("monthKey");
    expect(source).toContain("totalCents");
  });

  it("controla o estado de carregamento do botão Salvar", () => {
    const source = readSource("./QuickCardAdjustmentCard.tsx");

    expect(source).toContain("disabled={saving}");
    expect(source).toContain("Salvando…");
    expect(source).toContain("setSaving(true)");
    expect(source).toContain("setSaving(false)");
  });

  it("valida antes de enviar e expõe os erros exatos", () => {
    const source = readSource("./QuickCardAdjustmentCard.tsx");

    expect(source).toContain("validateCardAdjustment");
    expect(source).toContain("CARD_SELECTION_ERROR");
    expect(source).toContain("CARD_AMOUNT_ERROR");
    expect(source).toContain("aria-invalid={selectionInvalid}");
    expect(source).toContain("aria-invalid={amountInvalid}");
    expect(source).toContain('role="status"');
    expect(source).toContain('aria-live="polite"');
  });

  it("mapeia 201/200/400/rede para os feedbacks exatos da lib", () => {
    const source = readSource("./QuickCardAdjustmentCard.tsx");
    const lib = readSource("../lib/card-adjustment.ts");

    expect(source).toContain("response.status === 201");
    expect(source).toContain("response.status === 200");
    expect(source).toContain("response.status === 400");
    expect(source).toContain('status: "created"');
    expect(source).toContain('status: "no-op"');
    expect(source).toContain('status: "below"');
    expect(source).toContain('status: "network"');
    expect(source).toContain("cardAdjustmentFeedback");

    expect(normalize(lib)).toContain(
      "Ajuste criado: ${formatCents(outcome.diffCents)}. Fatura agora soma ${formatCents(outcome.totalCents)}",
    );
    expect(normalize(lib)).toContain(
      "A fatura já está no valor informado (${formatCents(outcome.totalCents)})",
    );
    expect(lib).toContain(
      '"Não foi possível ajustar a fatura. Tente novamente."',
    );
    expect(lib).toContain('"Selecione um cartão"');
    expect(lib).toContain('"Informe um valor maior que zero"');
  });

  it("exibe o valor atual com formatCents e limpa o campo no sucesso", () => {
    const source = readSource("./QuickCardAdjustmentCard.tsx");

    expect(source).toContain("formatCents(currentCents)");
    expect(source).toContain("useEffect(");
    expect(source).toContain("setTotals(totalsByCard)");
    expect(source).toContain('setAmount("")');
  });
});
