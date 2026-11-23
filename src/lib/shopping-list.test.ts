import { describe, expect, it } from "vitest";
import {
  ageLabel,
  buildShoppingPlan,
  DASHBOARD_ITEM_LIMIT,
  daysOnList,
  isStaleDesirable,
  modePriceCents,
  parsePriceToCents,
  previewShoppingItems,
  sortShoppingItems,
  STALE_DESIRABLE_DAYS,
  type ShoppingItem,
} from "./shopping-list";

const normalize = (value: string) => value.replace(/\u00a0/g, " ");

const item = (overrides: Partial<ShoppingItem> = {}): ShoppingItem => ({
  id: "item-1",
  name: "Arroz",
  kind: "ESSENCIAL",
  category: null,
  quantity: 1,
  estimatedUnitPriceCents: null,
  priceSource: null,
  priceSampleCount: 0,
  priceFetchedAt: null,
  purchased: false,
  purchasedAt: null,
  addedOn: "2026-11-01",
  ...overrides,
});

describe("parsePriceToCents", () => {
  it("converte número em reais para centavos", () => {
    expect(parsePriceToCents(12.5)).toBe(1250);
    expect(parsePriceToCents(10)).toBe(1000);
    expect(parsePriceToCents(0)).toBe(0);
  });

  it("converte texto pt-BR com símbolo e separadores", () => {
    expect(parsePriceToCents("R$ 1.234,56")).toBe(123456);
    expect(parsePriceToCents("12,50")).toBe(1250);
    expect(parsePriceToCents("1.234")).toBe(123400);
    expect(parsePriceToCents("$ 10.00")).toBe(1000);
  });

  it("retorna null para entradas malformadas ou negativas", () => {
    expect(parsePriceToCents("")).toBeNull();
    expect(parsePriceToCents("   ")).toBeNull();
    expect(parsePriceToCents("abc")).toBeNull();
    expect(parsePriceToCents("R$")).toBeNull();
    expect(parsePriceToCents("1,2,3")).toBeNull();
    expect(parsePriceToCents(-1)).toBeNull();
    expect(parsePriceToCents(Number.NaN)).toBeNull();
    expect(parsePriceToCents(Number.POSITIVE_INFINITY)).toBeNull();
    expect(parsePriceToCents(null)).toBeNull();
    expect(parsePriceToCents(undefined)).toBeNull();
  });
});

describe("modePriceCents", () => {
  it("usa o preço mais frequente", () => {
    expect(modePriceCents([1000, 1000, 1200])).toBe(1000);
  });

  it("no empate de frequência fica com o menor preço", () => {
    expect(modePriceCents([1500, 1200, 1200, 1500])).toBe(1200);
  });

  it("sem repetição usa a mediana (ímpar pega o centro)", () => {
    expect(modePriceCents([1000, 2000, 3000])).toBe(2000);
  });

  it("na mediana par fica com a menor das duas centrais", () => {
    expect(modePriceCents([4000, 1000, 3000, 2000])).toBe(2000);
    expect(modePriceCents([900, 100])).toBe(100);
  });

  it("ignora preços <= 0 e não finitos", () => {
    expect(modePriceCents([0, -500, 1000, Number.NaN, 1000])).toBe(1000);
    expect(modePriceCents([0, -1, Number.POSITIVE_INFINITY])).toBeNull();
  });

  it("retorna null sem amostras", () => {
    expect(modePriceCents([])).toBeNull();
  });
});

describe("daysOnList", () => {
  it("conta os dias completos entre addedOn e a referência", () => {
    expect(daysOnList("2026-11-01", "2026-11-23")).toBe(22);
    expect(daysOnList("2026-11-23", "2026-11-23")).toBe(0);
  });

  it("zera datas futuras ou inválidas", () => {
    expect(daysOnList("2026-11-24", "2026-11-23")).toBe(0);
    expect(daysOnList("ontem", "2026-11-23")).toBe(0);
    expect(daysOnList("2026-11-01", "")).toBe(0);
  });
});

describe("ageLabel", () => {
  it("formata dias no padrão pt-BR", () => {
    expect(ageLabel(22)).toBe("há 22 dias");
    expect(ageLabel(1)).toBe("há 1 dia");
    expect(ageLabel(0)).toBe("hoje");
  });

  it("marca adiado a partir de 30 dias", () => {
    expect(STALE_DESIRABLE_DAYS).toBe(30);
    expect(ageLabel(29)).toBe("há 29 dias");
    expect(ageLabel(30)).toBe("há 30 dias · adiado");
    expect(ageLabel(45)).toBe("há 45 dias · adiado");
  });

  it("permite desligar o sufixo de adiado", () => {
    expect(ageLabel(40, false)).toBe("há 40 dias");
  });
});

describe("isStaleDesirable", () => {
  it("é true apenas para desejável com 30 dias ou mais", () => {
    expect(
      isStaleDesirable(
        item({ kind: "DESEJAVEL", addedOn: "2026-10-24" }),
        "2026-11-23",
      ),
    ).toBe(true);
    expect(
      isStaleDesirable(
        item({ kind: "DESEJAVEL", addedOn: "2026-10-25" }),
        "2026-11-23",
      ),
    ).toBe(false);
  });

  it("nunca marca essencial como adiado", () => {
    expect(
      isStaleDesirable(
        item({ kind: "ESSENCIAL", addedOn: "2026-01-01" }),
        "2026-11-23",
      ),
    ).toBe(false);
  });
});

describe("sortShoppingItems", () => {
  it("coloca essenciais primeiro e desejáveis ao final", () => {
    const sorted = sortShoppingItems([
      item({ id: "d1", kind: "DESEJAVEL", addedOn: "2026-11-01", name: "Vinho" }),
      item({ id: "e1", kind: "ESSENCIAL", addedOn: "2026-11-05", name: "Leite" }),
    ]);

    expect(sorted.map((entry) => entry.id)).toEqual(["e1", "d1"]);
  });

  it("ordena do mais antigo para o mais novo dentro de cada grupo", () => {
    const sorted = sortShoppingItems([
      item({ id: "novo", addedOn: "2026-11-20", name: "Açúcar" }),
      item({ id: "antigo", addedOn: "2026-11-01", name: "Arroz" }),
      item({ id: "meio", addedOn: "2026-11-10", name: "Feijão" }),
    ]);

    expect(sorted.map((entry) => entry.id)).toEqual(["antigo", "meio", "novo"]);
  });

  it("desempata por nome na ordem pt-BR", () => {
    const sorted = sortShoppingItems([
      item({ id: "arroz", name: "Arroz" }),
      item({ id: "agua", name: "Água" }),
      item({ id: "banana", name: "Banana" }),
    ]);

    expect(sorted.map((entry) => entry.name)).toEqual([
      "Água",
      "Arroz",
      "Banana",
    ]);
  });

  it("exclui comprados e não muta a entrada", () => {
    const source = [
      item({ id: "ativo" }),
      item({ id: "comprado", purchased: true }),
    ];
    const snapshot = [...source];

    expect(sortShoppingItems(source).map((entry) => entry.id)).toEqual([
      "ativo",
    ]);
    expect(source).toEqual(snapshot);
  });
});

describe("previewShoppingItems", () => {
  const many = (count: number) =>
    Array.from({ length: count }, (_, index) =>
      item({ id: `i${index}`, name: `Item ${index}`, addedOn: `2026-11-${String(index + 1).padStart(2, "0")}` }),
    );

  it("limita ao padrão de 8 itens e informa os ocultos", () => {
    expect(DASHBOARD_ITEM_LIMIT).toBe(8);

    const preview = previewShoppingItems(many(10));

    expect(preview.items).toHaveLength(8);
    expect(preview.hiddenCount).toBe(2);
  });

  it("não conta comprados no limite", () => {
    const preview = previewShoppingItems([
      ...many(3),
      item({ id: "comprado", purchased: true }),
    ]);

    expect(preview.items).toHaveLength(3);
    expect(preview.hiddenCount).toBe(0);
  });

  it("respeita limite explícito", () => {
    const preview = previewShoppingItems(many(5), 2);

    expect(preview.items).toHaveLength(2);
    expect(preview.hiddenCount).toBe(3);
  });
});

describe("buildShoppingPlan", () => {
  it("soma unitário × quantidade e separa essenciais de desejáveis", () => {
    const plan = buildShoppingPlan(
      [
        item({ id: "e", kind: "ESSENCIAL", quantity: 2, estimatedUnitPriceCents: 1000 }),
        item({ id: "d", kind: "DESEJAVEL", quantity: 1, estimatedUnitPriceCents: 5000 }),
      ],
      5000,
    );

    expect(plan.totalCents).toBe(7000);
    expect(plan.essentialCents).toBe(2000);
    expect(plan.desirableCents).toBe(5000);
    expect(plan.itemCount).toBe(2);
    expect(plan.unpricedCount).toBe(0);
    expect(plan.unpricedLabel).toBeNull();
    expect(plan.daysOfAllowance).toBe(2);
  });

  it("gera o resumo exato com a diária do ciclo", () => {
    const plan = buildShoppingPlan(
      [item({ quantity: 1, estimatedUnitPriceCents: 30000 })],
      5000,
    );

    expect(plan.daysOfAllowance).toBe(6);
    expect(normalize(plan.summary)).toBe(
      "Se comprar tudo agora: R$ 300,00 (≈ 6 dias da diária do ciclo).",
    );
  });

  it("conta itens sem preço (ausente ou zero) e avisa", () => {
    const plan = buildShoppingPlan(
      [
        item({ id: "ok", estimatedUnitPriceCents: 2500 }),
        item({ id: "sem", estimatedUnitPriceCents: null }),
        item({ id: "zero", estimatedUnitPriceCents: 0 }),
      ],
      1000,
    );

    expect(plan.totalCents).toBe(2500);
    expect(plan.unpricedCount).toBe(2);
    expect(plan.unpricedLabel).toBe("2 itens sem preço");
  });

  it("usa singular quando há um único item sem preço", () => {
    const plan = buildShoppingPlan(
      [item({ estimatedUnitPriceCents: null })],
      1000,
    );

    expect(plan.unpricedLabel).toBe("1 item sem preço");
  });

  it("sem diária positiva retorna daysOfAllowance null e resumo sem dias", () => {
    const zero = buildShoppingPlan(
      [item({ estimatedUnitPriceCents: 30000 })],
      0,
    );
    expect(zero.daysOfAllowance).toBeNull();
    expect(normalize(zero.summary)).toBe("Se comprar tudo agora: R$ 300,00.");

    const negative = buildShoppingPlan(
      [item({ estimatedUnitPriceCents: 30000 })],
      -100,
    );
    expect(negative.daysOfAllowance).toBeNull();
  });

  it("ignora itens comprados", () => {
    const plan = buildShoppingPlan(
      [
        item({ id: "ativo", estimatedUnitPriceCents: 1000 }),
        item({ id: "comprado", purchased: true, estimatedUnitPriceCents: 9000 }),
      ],
      1000,
    );

    expect(plan.totalCents).toBe(1000);
    expect(plan.itemCount).toBe(1);
    expect(plan.unpricedCount).toBe(0);
  });

  it("lista vazia devolve plano zerado", () => {
    const plan = buildShoppingPlan([], 5000);

    expect(plan.totalCents).toBe(0);
    expect(plan.itemCount).toBe(0);
    expect(plan.daysOfAllowance).toBe(0);
    expect(normalize(plan.summary)).toBe(
      "Se comprar tudo agora: R$ 0,00 (≈ 0 dias da diária do ciclo).",
    );
  });
});
