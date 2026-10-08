/**
 * Normalização e sugestões de categorias (história #252).
 *
 * A categoria é texto livre: não existe enum nem tabela canônica. A
 * normalização é só de exibição/agrupamento — `trim`, colapso de espaços
 * internos e comparação case-insensitive em pt-BR. Acentos e palavras diferentes
 * permanecem distintos.
 *
 * Nenhuma função aqui acessa banco ou rede (ver categories.test.ts).
 */

/** Rótulo único usado para exibir/sugerir a ausência de categoria. */
export const NO_CATEGORY_LABEL = "Sem categoria";

/**
 * Normaliza um rótulo de categoria: remove espaços nas bordas, colapsa espaços
 * internos e devolve `null` quando o resultado é vazio/ausente.
 */
export function normalizeCategoryLabel(
  value: string | null | undefined,
): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(/\s+/g, " ");
  return normalized.length > 0 ? normalized : null;
}

/**
 * Chave de comparação: normaliza e passa para minúsculas em pt-BR. Vazio/ausente
 * vira `""`. Acentos são preservados (`"Alimentação"` ≠ `"Alimentacao"`).
 */
export function categoryKey(value: string | null | undefined): string {
  const normalized = normalizeCategoryLabel(value);
  return normalized ? normalized.toLocaleLowerCase("pt-BR") : "";
}

/** Rótulo de leitura: a categoria normalizada ou {@link NO_CATEGORY_LABEL}. */
export function categoryLabel(value: string | null | undefined): string {
  return normalizeCategoryLabel(value) ?? NO_CATEGORY_LABEL;
}

/**
 * Deduplica categorias pela {@link categoryKey}, descartando vazios, preservando
 * o primeiro rótulo de cada chave e ordenando em pt-BR.
 */
export function collectCategorySuggestions(
  values: Iterable<string | null | undefined>,
): string[] {
  const byKey = new Map<string, string>();
  for (const value of values) {
    const label = normalizeCategoryLabel(value);
    if (label === null) continue;
    const key = categoryKey(label);
    if (!byKey.has(key)) byKey.set(key, label);
  }
  return [...byKey.values()].sort((a, b) => a.localeCompare(b, "pt-BR"));
}
