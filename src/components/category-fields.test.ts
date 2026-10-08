import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Guarda o wiring de categoria (história #252) nos managers e nas páginas:
 * `list` + `<datalist>` com sugestões, leitura via `categoryLabel` e edição
 * pré-preenchida — sem perder o texto livre.
 */

function readSource(relativePath: string): string {
  return readFileSync(
    fileURLToPath(new URL(relativePath, import.meta.url)),
    "utf8",
  );
}

const MANAGERS = [
  "./GastosManager.tsx",
  "./FixedItemsManager.tsx",
  "./CreditCardsManager.tsx",
];

describe("categoria nos managers", () => {
  it("declara list + datalist e recebe categorySuggestions", () => {
    for (const path of MANAGERS) {
      const source = readSource(path);

      expect(source).toContain("categorySuggestions");
      expect(source).toContain("list={CATEGORY_DATALIST_ID}");
      expect(source).toContain("<CategoryDatalist");
    }
  });

  it("exibe a categoria salva com categoryLabel (null vira Sem categoria)", () => {
    for (const path of MANAGERS) {
      expect(readSource(path)).toContain("categoryLabel(");
    }
  });

  it("pré-preenche o campo de edição com o texto salvo", () => {
    expect(readSource("./GastosManager.tsx")).toContain(
      'category: expense.category ?? ""',
    );
    expect(readSource("./FixedItemsManager.tsx")).toContain(
      'setCategory(item.category ?? "")',
    );
    expect(readSource("./CreditCardsManager.tsx")).toContain(
      'setCategory(purchase.category ?? "")',
    );
  });
});

describe("sugestões nas páginas", () => {
  const PAGES = [
    "../app/(app)/gastos/page.tsx",
    "../app/(app)/saidas/page.tsx",
    "../app/(app)/cartoes/page.tsx",
  ];

  it("carrega e passa categorySuggestions", () => {
    for (const path of PAGES) {
      const source = readSource(path);

      expect(source).toContain("loadCategorySuggestions");
      expect(source).toContain("categorySuggestions={categorySuggestions}");
    }
  });

  it("o dashboard passa as sugestões ao lançamento rápido", () => {
    const page = readSource("../app/(app)/page.tsx");

    expect(page).toContain("loadCategorySuggestions");
    expect(page).toContain("<QuickExpenseCard categorySuggestions={categorySuggestions} />");
  });
});
