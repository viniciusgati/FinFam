import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { ShoppingItem } from "@/lib/shopping-list";
import ShoppingItemsManager from "./ShoppingItemsManager";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => {} }),
}));

const today = "2026-11-23";

function item(overrides: Partial<ShoppingItem>): ShoppingItem {
  return {
    id: overrides.id ?? overrides.name ?? "item",
    name: "Item",
    kind: "ESSENCIAL",
    category: null,
    quantity: 1,
    estimatedUnitPriceCents: null,
    purchased: false,
    addedOn: today,
    ...overrides,
  };
}

function render(items: ShoppingItem[] = []): string {
  return renderToStaticMarkup(
    createElement(ShoppingItemsManager, { initialItems: items, today }),
  ).replace(/\u00a0/g, " ");
}

describe("ShoppingItemsManager (markup estático)", () => {
  it("mostra o formulário com rótulos acessíveis e o botão de envio", () => {
    const html = render();

    for (const id of [
      "shopping-name",
      "shopping-kind",
      "shopping-quantity",
      "shopping-category",
      "shopping-price",
    ]) {
      expect(html).toContain(`for="${id}"`);
      expect(html).toContain(`id="${id}"`);
    }

    expect(html).toContain("Nome");
    expect(html).toContain("Classificação");
    expect(html).toContain("Quantidade");
    expect(html).toContain("Categoria (opcional)");
    expect(html).toContain("Preço unitário (R$, opcional)");
    expect(html).toContain("Adicionar item");
    expect(html).toContain('aria-invalid="false"');
    expect(html).toContain('aria-busy="false"');
  });

  it("sem itens ativos mostra o texto exato de lista vazia", () => {
    const html = render();

    expect(html).toContain(
      "Sua lista de compras está vazia. Adicione o primeiro item no formulário acima.",
    );
    expect(html).not.toContain("Pesquisar preço");
  });

  it("ordena essenciais primeiro, desejáveis ao final e exclui comprados", () => {
    const html = render([
      item({
        id: "vinho",
        name: "Vinho",
        kind: "DESEJAVEL",
        addedOn: "2026-10-20",
      }),
      item({ id: "arroz", name: "Arroz", addedOn: "2026-11-10" }),
      item({ id: "manteiga", name: "Manteiga", purchased: true }),
      item({
        id: "chocolate",
        name: "Chocolate",
        kind: "DESEJAVEL",
        addedOn: "2026-11-01",
      }),
    ]);

    expect(html).toContain("Arroz");
    expect(html).toContain("Chocolate");
    expect(html).toContain("Vinho");
    expect(html).not.toContain("Manteiga");
    expect(html.indexOf("Arroz")).toBeLessThan(html.indexOf("Vinho"));
    expect(html.indexOf("Vinho")).toBeLessThan(html.indexOf("Chocolate"));
  });

  it("mostra a idade na lista e o rótulo de adiado após 30 dias", () => {
    const html = render([
      item({
        id: "chocolate",
        name: "Chocolate",
        kind: "DESEJAVEL",
        addedOn: "2026-11-01",
      }),
      item({
        id: "vinho",
        name: "Vinho",
        kind: "DESEJAVEL",
        addedOn: "2026-10-20",
      }),
    ]);

    expect(html).toContain("há 22 dias");
    expect(html).toContain("há 34 dias · adiado");
    expect(html).toContain(">adiado</span>");
  });

  it("exibe preço unitário, total da linha e amostras", () => {
    const html = render([
      item({
        id: "arroz",
        name: "Arroz",
        quantity: 2,
        estimatedUnitPriceCents: 1200,
        priceSampleCount: 3,
      }),
    ]);

    expect(html).toContain("R$ 12,00");
    expect(html).toContain("por unidade");
    expect(html).toContain("total R$ 24,00");
    expect(html).toContain("3 amostras");
  });

  it("exibe 'Sem preço estimado' quando o item não tem preço", () => {
    const html = render([item({ id: "sal", name: "Sal" })]);

    expect(html).toContain("Sem preço estimado");
  });

  it("expõe as três ações por item com os textos exatos", () => {
    const html = render([item({ id: "arroz", name: "Arroz" })]);

    expect(html).toContain("Pesquisar preço");
    expect(html).toContain("Marcar como comprado");
    expect(html).toContain("Excluir");
    expect(html).toContain('type="button"');
  });

  it("mantém as mensagens de carregando e de feedback no código da tela", () => {
    const source = readFileSync(
      new URL("./ShoppingItemsManager.tsx", import.meta.url),
      "utf8",
    );

    for (const text of [
      "Adicionando…",
      "Pesquisando…",
      "Salvando…",
      "Excluindo…",
      "Item adicionado à lista.",
      "Preço atualizado:",
      "Não encontramos preços para este item.",
      "Pesquisa de preço indisponível. Informe o preço manualmente ou configure a integração.",
      "Não foi possível pesquisar o preço agora. Tente novamente.",
      "Item marcado como comprado.",
      "Não foi possível marcar o item como comprado. Tente novamente.",
      "Item excluído.",
      "Não foi possível excluir o item. Tente novamente.",
      "Não foi possível adicionar o item. Tente novamente.",
      "Sua lista de compras está vazia. Adicione o primeiro item no formulário acima.",
    ]) {
      expect(source).toContain(text);
    }
    expect(source).toContain("aria-busy={");
    expect(source).toContain('role="alert"');
    expect(source).toContain('role="status"');
    expect(source).toContain("deleteConfirmMessage(item.name)");
  });
});
