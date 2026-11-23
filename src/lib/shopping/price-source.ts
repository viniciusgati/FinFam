/**
 * Pesquisa de preço sob demanda em uma fonte externa compatível com a API do
 * SerpAPI para o Google Shopping (história #376).
 *
 * A integração é opcional: a chave vem de `PRICE_SEARCH_API_KEY` e a URL de
 * `PRICE_SEARCH_API_URL` (padrão `https://serpapi.com/search.json`). Sem chave,
 * nada é enviado à rede (`PriceSourceUnavailableError`). Apenas o **nome** do
 * produto é enviado como termo de busca; valores, categoria e demais dados da
 * família nunca saem daqui.
 *
 * Os preços retornados já são amostras em centavos inteiros (parse de
 * `shopping_results[].extracted_price`/`price`), limitadas a
 * `MAX_PRICE_RESULTS`. Nenhuma função aqui lê o relógio além do timeout.
 */

import { parsePriceToCents } from "../shopping-list";

type EnvRecord = Record<string, string | undefined>;

export interface PriceSearchConfig {
  apiKey: string;
  apiUrl: string;
}

export interface PriceSearchOptions {
  fetchImpl?: typeof fetch;
  env?: EnvRecord;
  timeoutMs?: number;
}

/** Contrato de uma fonte de preços: devolve amostras unitárias em centavos. */
export interface PriceSource {
  readonly name: string;
  search(query: string): Promise<number[]>;
}

export const DEFAULT_PRICE_SEARCH_API_URL = "https://serpapi.com/search.json";

/** Nome persistido em `priceSource` quando a origem é o Google Shopping. */
export const PRICE_SOURCE_NAME = "google_shopping";

/** Timeout máximo da chamada externa. */
export const PRICE_SEARCH_TIMEOUT_MS = 5000;

/** Máximo de resultados considerados por pesquisa. */
export const MAX_PRICE_RESULTS = 20;

/** Lançado quando falta `PRICE_SEARCH_API_KEY` (nada deve ir à rede). */
export class PriceSourceUnavailableError extends Error {
  constructor() {
    super("price_source_unavailable");
    this.name = "PriceSourceUnavailableError";
  }
}

/** Lançado quando o provedor falha, responde não-2xx ou expira. */
export class PriceSearchError extends Error {
  constructor(cause?: unknown) {
    super("price_search_failed", { cause });
    this.name = "PriceSearchError";
  }
}

/** Config efetiva da pesquisa, ou `null` quando a chave está ausente/vazia. */
export function resolvePriceSearchConfig(
  env: EnvRecord = process.env,
): PriceSearchConfig | null {
  const apiKey = env.PRICE_SEARCH_API_KEY?.trim();
  if (!apiKey) return null;
  return {
    apiKey,
    apiUrl: env.PRICE_SEARCH_API_URL?.trim() || DEFAULT_PRICE_SEARCH_API_URL,
  };
}

export function isPriceSearchConfigured(env: EnvRecord = process.env): boolean {
  return resolvePriceSearchConfig(env) !== null;
}

interface SerpApiShoppingResult {
  extracted_price?: number | string | null;
  price?: number | string | null;
}

interface SerpApiResponse {
  shopping_results?: SerpApiShoppingResult[];
}

/**
 * Monta a URL da chamada. Só o termo (`q`) e parâmetros técnicos entram na
 * query string — nunca outros dados do item.
 */
export function buildPriceSearchUrl(
  apiUrl: string,
  apiKey: string,
  query: string,
): string {
  const url = new URL(apiUrl);
  url.searchParams.set("engine", "google_shopping");
  url.searchParams.set("gl", "br");
  url.searchParams.set("hl", "pt-br");
  url.searchParams.set("q", query);
  url.searchParams.set("api_key", apiKey);
  return url.toString();
}

/**
 * Extrai as amostras válidas (centavos `> 0`) dos resultados do provedor,
 * usando `extracted_price` e caindo para `price` quando necessário.
 */
export function extractPricesCents(data: SerpApiResponse): number[] {
  const results = Array.isArray(data.shopping_results)
    ? data.shopping_results.slice(0, MAX_PRICE_RESULTS)
    : [];

  const prices: number[] = [];
  for (const result of results) {
    const extracted = parsePriceToCents(result.extracted_price);
    const cents =
      extracted !== null && extracted > 0
        ? extracted
        : parsePriceToCents(result.price);
    if (cents !== null && cents > 0) prices.push(cents);
  }
  return prices;
}

/**
 * Pesquisa o preço do produto no Google Shopping (via SerpAPI) e devolve as
 * amostras em centavos. Sem chave lança `PriceSourceUnavailableError`; falha,
 * resposta não-2xx ou timeout lançam `PriceSearchError`.
 */
export async function searchGoogleShoppingPrices(
  query: string,
  options: PriceSearchOptions = {},
): Promise<number[]> {
  const config = resolvePriceSearchConfig(options.env);
  if (!config) throw new PriceSourceUnavailableError();

  const fetchImpl = options.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? PRICE_SEARCH_TIMEOUT_MS,
  );

  try {
    const url = buildPriceSearchUrl(config.apiUrl, config.apiKey, query);
    let response: Response;
    try {
      response = await fetchImpl(url, {
        method: "GET",
        headers: { accept: "application/json" },
        signal: controller.signal,
      });
    } catch (error) {
      throw new PriceSearchError(error);
    }

    if (!response.ok) {
      throw new PriceSearchError(`Provedor respondeu ${response.status}`);
    }

    let data: SerpApiResponse;
    try {
      data = (await response.json()) as SerpApiResponse;
    } catch (error) {
      throw new PriceSearchError(error);
    }

    return extractPricesCents(data);
  } finally {
    clearTimeout(timeout);
  }
}

/** Fonte de preços pronta para uso (Google Shopping via SerpAPI). */
export function createGoogleShoppingPriceSource(
  options: PriceSearchOptions = {},
): PriceSource {
  return {
    name: PRICE_SOURCE_NAME,
    search: (query: string) => searchGoogleShoppingPrices(query, options),
  };
}
