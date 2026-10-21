/**
 * Classificação de títulos de fatura importada (história #269, subtarefa 3).
 *
 * Duas etapas, sempre na ordem:
 * 1. **Local** — se a descrição normalizada (com e sem o prefixo `IOF de `)
 *    já existir categorizada no histórico da família, reaproveita a categoria
 *    sem tocar na rede.
 * 2. **IA em lote** — para o que restar, **uma única** chamada à DeepSeek com
 *    os títulos pendentes + os rótulos de categoria já usados pela família
 *    (deduplicados, sem `Ajuste`). A resposta é validada contra a lista.
 *
 * Exceção documentada à SPEC §7: nesta função apenas **títulos de lançamento
 * e rótulos de categoria** trafegam até a DeepSeek — nunca valores, datas,
 * identificadores ou nomes da família.
 *
 * A importação nunca é bloqueada: sem chave, falha de rede/resposta ou rótulo
 * fora da lista resultam em `null` (categoria vazia) para o título, sem
 * exceção propagada.
 */

import { categoryKey, collectCategorySuggestions } from "../categories";
import {
  chatCompletion,
  type ChatCompletionOptions,
  type ChatMessage,
} from "./deepseek";

/** Rótulo que nunca é sugerido à IA (categoria de ajuste manual de fatura). */
const EXCLUDED_LABEL = "Ajuste";

/** Prefixo de IOF do Nubank removido na comparação local. */
const IOF_PREFIX = /^iof de\s+/i;

/** Normaliza um título para comparação: trim + colapso de espaços internos. */
export function normalizeInvoiceTitle(title: string): string {
  return title.trim().replace(/\s+/g, " ");
}

/** Remove o prefixo `IOF de ` (case-insensitive) de um título normalizado. */
export function stripIofPrefix(title: string): string {
  return normalizeInvoiceTitle(title).replace(IOF_PREFIX, "");
}

/** Chave de match local: sem prefixo IOF, trim e minúsculas pt-BR. */
function invoiceTitleKey(title: string): string {
  return stripIofPrefix(title).toLocaleLowerCase("pt-BR");
}

const SYSTEM_PROMPT =
  "Você é um classificador de compras de cartão de crédito de uma família " +
  "brasileira. Receberá os títulos de lançamentos de uma fatura e a lista de " +
  "rótulos de categoria já usados pela família. Para cada título, escolha o " +
  "rótulo mais adequado. Responda somente com um array JSON de mesma " +
  "comprimento, onde cada item é o rótulo escolhido ou null quando nenhum " +
  "se encaixa. Não invente rótulos fora da lista.";

/** Mensagens para a DeepSeek: apenas títulos de lançamento e rótulos. */
export function buildInvoiceClassificationPrompt(
  titles: string[],
  labels: string[],
): ChatMessage[] {
  return [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: JSON.stringify({ titles, labels }) },
  ];
}

/** Remove cercas de código Markdown que o modelo por vezes envolve. */
function stripCodeFences(content: string): string {
  return content
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
}

/**
 * Valida a resposta da IA contra os rótulos candidatos: devolve o rótulo
 * **canônico** da lista (comparação por {@link categoryKey}) ou `null` para
 * entrada ausente, fora da lista ou de tipo inválido. Resposta que não seja
 * array vira `null` para todos.
 */
export function parseClassificationResponse(
  content: string,
  labels: string[],
  count: number,
): (string | null)[] {
  const fallback = Array.from({ length: count }, () => null);
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripCodeFences(content));
  } catch {
    return fallback;
  }
  if (!Array.isArray(parsed)) return fallback;

  const canonical = new Map(labels.map((label) => [categoryKey(label), label]));
  return Array.from({ length: count }, (_, index) => {
    const entry: unknown = parsed[index];
    if (typeof entry !== "string") return null;
    return canonical.get(categoryKey(entry)) ?? null;
  });
}

/**
 * Classifica `titles` (na ordem da fatura) devolvendo, para cada título, a
 * categoria da família ou `null`. Match local primeiro; o restante vai em
 * **uma** chamada em lote à DeepSeek. Nunca lança exceção por falha de IA.
 */
export async function classifyInvoiceTitles(
  titles: string[],
  suggestions: string[],
  existingByTitle: ReadonlyMap<string, string | null>,
  options: ChatCompletionOptions = {},
): Promise<(string | null)[]> {
  // Histórico da família indexado pela chave normalizada (sem prefixo IOF).
  const lookup = new Map<string, string>();
  for (const [rawTitle, category] of existingByTitle) {
    const label = typeof category === "string" ? category.trim() : "";
    if (!label) continue;
    const key = invoiceTitleKey(rawTitle);
    if (key && !lookup.has(key)) lookup.set(key, label);
  }

  const results: (string | null)[] = titles.map(
    (title) => lookup.get(invoiceTitleKey(title)) ?? null,
  );

  const pendingIndexes = titles
    .map((_, index) => index)
    .filter((index) => results[index] === null);
  if (pendingIndexes.length === 0) return results;

  const labels = collectCategorySuggestions(suggestions).filter(
    (label) => categoryKey(label) !== categoryKey(EXCLUDED_LABEL),
  );
  if (labels.length === 0) return results;

  const pendingTitles = pendingIndexes.map((index) => titles[index]);
  try {
    const content = await chatCompletion(
      buildInvoiceClassificationPrompt(pendingTitles, labels),
      options,
    );
    const classified = parseClassificationResponse(content, labels, pendingTitles.length);
    pendingIndexes.forEach((titleIndex, offset) => {
      results[titleIndex] = classified[offset];
    });
  } catch {
    // Sem chave, falha de rede ou resposta vazia: categoria vazia, sem bloquear.
  }
  return results;
}
