import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import ShoppingListCard from "./ShoppingListCard";
import {
  buildShoppingPlan,
  type ShoppingItem,
} from "@/lib/shopping-list";

const TODAY = "2026-11-23";

function item(overrides: Partial<ShoppingItem> = {}): ShoppingItem {
  return {
    id: overrides.id ?? "item-1",
    name: overrides.name ?? "Arroz",
    kind: overrides.kind ?? "ESSENCIAL",
    category: overrides.category ?? null,
    quantity: overrides.quantity ?? 1,
    estimatedUnitPriceCents:
      overrides.estimatedUnitPriceCents === undefined
        ? 1000
        : overrides.estimatedUnitPriceCents,
    purchased: overrides.purchased ?? false,
    addedOn: overrides.addedOn ?? "2026-11-20",
  };
}

function render(
  items: ShoppingItem[],
  dailyAllowanceCents = 5000,
): string {
  return renderToStaticMarkup(
    createElement(ShoppingListCard, {
      plan: buildShoppingPlan(items, dailyAllowanceCents),
      items,
      referenceDate: TODAY,
    }),
  ).replace(/\u00a0/g, " ");
}

describe("ShoppingListCard (renderização)", () => {
  it("mostra o plano total, dias de diária e valores separados", () => {
    const html = render([
      item({ id: "arroz", name: "Arroz", quantity: 2, estimatedUnitPriceCents: 10000 }),
      item({
        id: "vinho",
        name: "Vinho",
        kind: "DESEJAVEL",
        quantity: 2,
        estimatedUnitPriceCents: 5000,
      }),
    ]);

    expect(html).toContain("Lista de compras");
    expect(html).toContain(
      "Se comprar tudo agora: R$ 300,00 (≈ 6 dias da diária do ciclo).",
    );
    expect(html).toContain("Essenciais");
    expect(html).toContain("R$ 200,00");
    expect(html).toContain("Desejáveis");
    expect(html).toContain("R$ 100,00");
    expect(html).toContain('href="/compras"');
    expect(html).toContain("Ver todos");
  });

  it("avisa quantos itens ativos estão sem preço", () => {
    const html = render([
      item({ id: "arroz", estimatedUnitPriceCents: 1000 }),
      item({ id: "feijao", name: "Feijão", estimatedUnitPriceCents: null }),
      item({ id: "cafe", name: "Café", estimatedUnitPriceCents: 0 }),
    ]);

    expect(html).toContain("2 itens sem preço");
  });

  it("lista no máximo 8 itens e informa quantos ficaram de fora", () => {
    const names = Array.from({ length: 10 }, (_, index) =>
      `Item ${String(index + 1).padStart(2, "0")}`,
    );
    const html = render(
      names.map((name, index) =>
        item({ id: `item-${index}`, name, addedOn: "2026-11-20" }),
      ),
    );

    expect(html).toContain("Item 01");
    expect(html).toContain("Item 08");
    expect(html).not.toContain("Item 09");
    expect(html).not.toContain("Item 10");
    expect(html).toContain("+2 itens");
  });

  it("conta desejáveis adiados e usa o rótulo de idade com o sufixo", () => {
    const html = render([
      item({ id: "leite", name: "Leite", addedOn: "2026-11-20" }),
      item({
        id: "vinho",
        name: "Vinho",
        kind: "DESEJAVEL",
        addedOn: "2026-10-24",
      }),
      item({
        id: "cerveja",
        name: "Cerveja",
        kind: "DESEJAVEL",
        addedOn: "2026-11-01",
      }),
    ]);

    expect(html).toContain("1 desejável adiado");
    expect(html).toContain("há 30 dias · adiado");
    expect(html).toContain("há 22 dias");
    expect(html).not.toContain("há 22 dias · adiado");
  });

  it("não usa placeholder quando não há itens sem preço nem adiados", () => {
    const html = render([item()]);

    expect(html).not.toContain("sem preço");
    expect(html).not.toContain("adiado");
    expect(html).not.toContain("+0");
  });
});
