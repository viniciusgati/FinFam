import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_PRICE_SEARCH_API_URL,
  MAX_PRICE_RESULTS,
  PRICE_SOURCE_NAME,
  PriceSearchError,
  PriceSourceUnavailableError,
  buildPriceSearchUrl,
  createGoogleShoppingPriceSource,
  extractPricesCents,
  isPriceSearchConfigured,
  resolvePriceSearchConfig,
  searchGoogleShoppingPrices,
} from "./price-source";

type FetchImpl = (url: string, init: RequestInit) => Promise<Response>;

function makeFetch(impl: FetchImpl) {
  return vi.fn(impl);
}

function shoppingResponse(results: unknown[]): Response {
  return new Response(JSON.stringify({ shopping_results: results }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

const KEY_ENV = { PRICE_SEARCH_API_KEY: "chave-secreta" };

afterEach(() => {
  vi.useRealTimers();
});

describe("resolvePriceSearchConfig", () => {
  it("retorna null sem chave (ou com chave em branco)", () => {
    expect(resolvePriceSearchConfig({})).toBeNull();
    expect(resolvePriceSearchConfig({ PRICE_SEARCH_API_KEY: "   " })).toBeNull();
  });

  it("usa o endpoint do SerpAPI quando PRICE_SEARCH_API_URL está ausente", () => {
    expect(resolvePriceSearchConfig(KEY_ENV)).toEqual({
      apiKey: "chave-secreta",
      apiUrl: DEFAULT_PRICE_SEARCH_API_URL,
    });
    expect(DEFAULT_PRICE_SEARCH_API_URL).toBe(
      "https://serpapi.com/search.json",
    );
  });

  it("PRICE_SEARCH_API_URL sobrescreve o padrão", () => {
    expect(
      resolvePriceSearchConfig({
        ...KEY_ENV,
        PRICE_SEARCH_API_URL: "https://exemplo.test/search.json",
      }),
    ).toEqual({
      apiKey: "chave-secreta",
      apiUrl: "https://exemplo.test/search.json",
    });
  });
});

describe("isPriceSearchConfigured", () => {
  it("reflete a presença da chave", () => {
    expect(isPriceSearchConfigured({})).toBe(false);
    expect(isPriceSearchConfigured(KEY_ENV)).toBe(true);
  });
});

describe("buildPriceSearchUrl", () => {
  it("inclui apenas o termo e os parâmetros técnicos do Google Shopping", () => {
    const url = new URL(
      buildPriceSearchUrl(
        DEFAULT_PRICE_SEARCH_API_URL,
        "segredo",
        "Leite integral",
      ),
    );

    expect(url.origin + url.pathname).toBe(
      "https://serpapi.com/search.json",
    );
    expect(url.searchParams.get("engine")).toBe("google_shopping");
    expect(url.searchParams.get("gl")).toBe("br");
    expect(url.searchParams.get("hl")).toBe("pt-br");
    expect(url.searchParams.get("q")).toBe("Leite integral");
    expect(url.searchParams.get("api_key")).toBe("segredo");
    expect([...url.searchParams.keys()].sort()).toEqual([
      "api_key",
      "engine",
      "gl",
      "hl",
      "q",
    ]);
  });
});

describe("extractPricesCents", () => {
  it("lê extracted_price em centavos inteiros", () => {
    expect(
      extractPricesCents({
        shopping_results: [
          { extracted_price: 10.0 },
          { extracted_price: 10.0 },
          { extracted_price: 12.0 },
        ],
      }),
    ).toEqual([1000, 1000, 1200]);
  });

  it("cai para o texto de price quando não há extracted_price", () => {
    expect(
      extractPricesCents({
        shopping_results: [
          { price: "R$ 10,00" },
          { price: "R$ 1.234,56" },
        ],
      }),
    ).toEqual([1000, 123456]);
  });

  it("ignora preços ausentes, zero, negativos e malformados", () => {
    expect(
      extractPricesCents({
        shopping_results: [
          { extracted_price: 0 },
          { extracted_price: -5 },
          { price: "indisponível" },
          {},
          { extracted_price: 7.5 },
        ],
      }),
    ).toEqual([750]);
  });

  it("respeita o limite de 20 resultados", () => {
    const results = Array.from({ length: 25 }, (_, index) => ({
      extracted_price: index + 1,
    }));

    expect(extractPricesCents({ shopping_results: results })).toHaveLength(
      MAX_PRICE_RESULTS,
    );
    expect(MAX_PRICE_RESULTS).toBe(20);
  });

  it("retorna [] sem shopping_results", () => {
    expect(extractPricesCents({})).toEqual([]);
  });
});

describe("searchGoogleShoppingPrices", () => {
  it("sem chave lança PriceSourceUnavailableError e não chama a rede", async () => {
    const fetchImpl = makeFetch(async () => shoppingResponse([]));

    await expect(
      searchGoogleShoppingPrices("Leite", {
        env: {},
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).rejects.toBeInstanceOf(PriceSourceUnavailableError);

    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("pesquisa apenas com o nome do produto e devolve as amostras", async () => {
    const fetchImpl = makeFetch(async () =>
      shoppingResponse([
        { extracted_price: 10.0 },
        { extracted_price: 10.0 },
        { extracted_price: 12.0 },
      ]),
    );

    const prices = await searchGoogleShoppingPrices("Leite integral", {
      env: KEY_ENV,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(prices).toEqual([1000, 1000, 1200]);

    const [rawUrl, init] = fetchImpl.mock.calls[0];
    const url = new URL(String(rawUrl));
    expect(url.searchParams.get("q")).toBe("Leite integral");
    expect(url.searchParams.get("api_key")).toBe("chave-secreta");
    expect(url.searchParams.has("category")).toBe(false);
    expect(url.searchParams.has("price")).toBe(false);
    expect(init).toMatchObject({ method: "GET" });
  });

  it("usa PRICE_SEARCH_API_URL customizada quando configurada", async () => {
    const fetchImpl = makeFetch(async () => shoppingResponse([]));

    await searchGoogleShoppingPrices("Arroz", {
      env: {
        PRICE_SEARCH_API_KEY: "k",
        PRICE_SEARCH_API_URL: "https://exemplo.test/shopping",
      },
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(String(fetchImpl.mock.calls[0][0])).toMatch(
      /^https:\/\/exemplo\.test\/shopping\?/,
    );
  });

  it("usa o endpoint do SerpAPI quando PRICE_SEARCH_API_URL está ausente", async () => {
    const fetchImpl = makeFetch(async () => shoppingResponse([]));

    await searchGoogleShoppingPrices("Arroz", {
      env: KEY_ENV,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(String(fetchImpl.mock.calls[0][0])).toMatch(
      /^https:\/\/serpapi\.com\/search\.json\?/,
    );
  });

  it("lança PriceSearchError em resposta não-2xx", async () => {
    const fetchImpl = makeFetch(
      async () => new Response("nope", { status: 500 }),
    );

    await expect(
      searchGoogleShoppingPrices("Arroz", {
        env: KEY_ENV,
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).rejects.toBeInstanceOf(PriceSearchError);
  });

  it("lança PriceSearchError quando a conexão falha", async () => {
    const fetchImpl = makeFetch(async () => {
      throw new Error("boom");
    });

    await expect(
      searchGoogleShoppingPrices("Arroz", {
        env: KEY_ENV,
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).rejects.toBeInstanceOf(PriceSearchError);
  });

  it("aborta por timeout via AbortController", async () => {
    vi.useFakeTimers();
    const fetchImpl = makeFetch(
      (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener("abort", () =>
            reject(new Error("aborted")),
          );
        }),
    );

    const promise = searchGoogleShoppingPrices("Arroz", {
      env: KEY_ENV,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      timeoutMs: 50,
    });
    const assertion = expect(promise).rejects.toBeInstanceOf(PriceSearchError);
    await vi.advanceTimersByTimeAsync(60);
    await assertion;
  });
});

describe("createGoogleShoppingPriceSource", () => {
  it("expõe o nome do provedor e delega a busca", async () => {
    const fetchImpl = makeFetch(async () =>
      shoppingResponse([{ extracted_price: 9.9 }]),
    );
    const source = createGoogleShoppingPriceSource({
      env: KEY_ENV,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(source.name).toBe(PRICE_SOURCE_NAME);
    expect(PRICE_SOURCE_NAME).toBe("google_shopping");
    await expect(source.search("Café")).resolves.toEqual([990]);
  });
});
