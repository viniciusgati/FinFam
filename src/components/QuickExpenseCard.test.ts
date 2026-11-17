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

function functionBody(source: string, signature: string): string {
  const start = source.indexOf(signature);
  expect(start).toBeGreaterThanOrEqual(0);
  return source.slice(start, source.indexOf("\n  }\n", start));
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

  it("oferece Despesa e Entrada com despesa selecionada por padrão", () => {
    const html = render();

    expect(html).toContain(">Despesa<");
    expect(html).toContain(">Entrada<");
    expect(html).toMatch(
      /<button[^>]*type="button"[^>]*aria-pressed="true"[^>]*>Despesa<\/button>/,
    );
    expect(html).toMatch(
      /<button[^>]*type="button"[^>]*aria-pressed="false"[^>]*>Entrada<\/button>/,
    );
  });

  it("mantém subtítulo de gasto e categoria no modo despesa", () => {
    const html = render();

    expect(html).toContain(
      "Registre um gasto em segundos, sem sair do dashboard.",
    );
    expect(html).toContain("Categoria");
    expect(html).toContain("Este lançamento já nasce marcado como pago.");
  });
});

describe("QuickExpenseCard (modo entrada e wiring)", () => {
  const source = readSource("./QuickExpenseCard.tsx");

  it("esconde categoria e nota de pago no modo entrada", () => {
    expect(source).toContain(
      "Registre uma entrada em segundos, sem sair do dashboard.",
    );
    expect(source).toContain("!isIncome ? (");
    expect(source).toContain("bg-sky-600");
    expect(source).toContain("bg-emerald-600");
  });

  it("roteia o POST para a API do tipo selecionado", () => {
    expect(source).toContain('"/api/variable-incomes"');
    expect(source).toContain('"/api/variable-expenses"');
    expect(source).toContain("buildQuickIncomePayload");
    expect(source).toContain("buildQuickExpensePayload");
  });

  it("limpa o status ao alternar o tipo", () => {
    const body = functionBody(source, "function selectEntryType(");

    expect(body).toContain("setEntryType(type)");
    expect(body).toContain("setFeedback(null)");
  });

  it("valida a entrada antes de chamar fetch", () => {
    const body = source.slice(
      source.indexOf("async function handleSubmit("),
      source.indexOf("return ("),
    );

    expect(body.indexOf("validateQuickIncome")).toBeLessThan(
      body.indexOf("buildQuickIncomePayload"),
    );
    expect(body.indexOf("if (Object.keys(validation).length > 0) return;")).toBeLessThan(
      body.indexOf("submitPayload("),
    );
  });

  it("mantém carregamento, erro de rede e aviso de outro mês", () => {
    expect(source).toContain("disabled={submitting}");
    expect(source).toContain("aria-busy={submitting}");
    expect(source).toContain('{submitting ? "Salvando..." : "Salvar"}');
    expect(source).toContain("NETWORK_ERROR_MESSAGE");
    expect(source).toContain("cycleSavedElsewhereMessage");
    expect(source).toContain('"Entrada criada"');
    expect(source).toContain('"Gasto criado"');
  });
});

describe("dashboard passa a janela do ciclo ao card", () => {
  it("fornece mês de referência e limites ISO do ciclo exibido", () => {
    const page = readSource("../app/(app)/page.tsx");

    expect(page).toContain("referenceMonthKey={referenceMonthKey}");
    expect(page).toContain("windowStart={");
    expect(page).toContain("windowNextStart={");
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

describe("QuickExpenseCard (acessibilidade do formulário)", () => {
  it("dá id e name a todos os campos do lançamento rápido (regressão #373)", () => {
    const html = render({ cards: CARDS });

    expect(html).toMatch(/<select[^>]*id="quick-payment"[^>]*name="payment"/);
    expect(html).toMatch(/<input[^>]*id="quick-date"[^>]*name="date"/);
    expect(html).toMatch(
      /<input[^>]*id="quick-description"[^>]*name="description"/,
    );
    expect(html).toMatch(/<input[^>]*id="quick-amount"[^>]*name="amount"/);
    expect(html).toMatch(/<input[^>]*id="quick-category"[^>]*name="category"/);
  });

  it("associa cada rótulo visível ao respectivo campo", () => {
    const html = render({ cards: CARDS });

    expect(html).toMatch(/<label[^>]*>Data<input[^>]*id="quick-date"/s);
    expect(html).toMatch(
      /<label[^>]*>Descrição<input[^>]*id="quick-description"/s,
    );
    expect(html).toMatch(/<label[^>]*>Valor \(R\$\)<input[^>]*id="quick-amount"/s);
    expect(html).toMatch(
      /<label[^>]*>Categoria<input[^>]*id="quick-category"/s,
    );
  });
});
