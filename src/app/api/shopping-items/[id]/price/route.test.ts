import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { findUniqueMock, updateMock } = vi.hoisted(() => ({
  findUniqueMock: vi.fn(),
  updateMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    shoppingItem: {
      findUnique: findUniqueMock,
      update: updateMock,
    },
  },
}));

import { POST } from "./route";

const originalKey = process.env.PRICE_SEARCH_API_KEY;
const originalUrl = process.env.PRICE_SEARCH_API_URL;

const params = (id: string) => ({ params: Promise.resolve({ id }) });

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: "item-1",
    name: "Leite integral",
    kind: "ESSENCIAL",
    category: "Mercearia",
    quantity: 2,
    estimatedUnitPriceCents: 500,
    priceSource: null,
    priceSampleCount: 0,
    priceFetchedAt: null,
    purchased: false,
    purchasedAt: null,
    addedOn: "2026-11-01",
    createdAt: new Date("2026-11-01T12:00:00.000Z"),
    updatedAt: new Date("2026-11-01T12:00:00.000Z"),
    ...overrides,
  };
}

function searchResponse(results: unknown[]): Response {
  return new Response(JSON.stringify({ shopping_results: results }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function priceRequest(): Request {
  return new Request("http://localhost/api/shopping-items/item-1/price", {
    method: "POST",
  });
}

beforeEach(() => {
  findUniqueMock.mockReset();
  updateMock.mockReset();
  vi.unstubAllGlobals();
  delete process.env.PRICE_SEARCH_API_KEY;
  delete process.env.PRICE_SEARCH_API_URL;
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  if (originalKey === undefined) delete process.env.PRICE_SEARCH_API_KEY;
  else process.env.PRICE_SEARCH_API_KEY = originalKey;
  if (originalUrl === undefined) delete process.env.PRICE_SEARCH_API_URL;
  else process.env.PRICE_SEARCH_API_URL = originalUrl;
});

describe("POST /api/shopping-items/:id/price", () => {
  it("atualiza o preço pela moda das amostras e responde 200", async () => {
    process.env.PRICE_SEARCH_API_KEY = "chave";
    findUniqueMock.mockResolvedValue(row());
    updateMock.mockImplementation(
      ({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve(row(data)),
    );
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        searchResponse([
          { extracted_price: 10.0 },
          { extracted_price: 10.0 },
          { extracted_price: 12.0 },
        ]),
      );
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(priceRequest(), params("item-1"));

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      updated: boolean;
      item: { estimatedUnitPriceCents: number; priceSampleCount: number; priceSource: string; priceFetchedAt: Date };
    };
    expect(body.updated).toBe(true);
    expect(body.item.estimatedUnitPriceCents).toBe(1000);
    expect(body.item.priceSampleCount).toBe(3);
    expect(body.item.priceSource).toBe("google_shopping");
    expect(body.item.priceFetchedAt).toBeTruthy();

    expect(updateMock).toHaveBeenCalledTimes(1);
    const [args] = updateMock.mock.calls[0];
    expect(args.where).toEqual({ id: "item-1" });
    expect(args.data).toMatchObject({
      estimatedUnitPriceCents: 1000,
      priceSampleCount: 3,
      priceSource: "google_shopping",
    });
    expect(args.data.priceFetchedAt).toBeInstanceOf(Date);

    const [rawUrl] = fetchMock.mock.calls[0];
    const url = new URL(String(rawUrl));
    expect(url.searchParams.get("q")).toBe("Leite integral");
    expect(url.searchParams.get("category")).toBeNull();
    expect(url.searchParams.get("price")).toBeNull();
  });

  it("sem PRICE_SEARCH_API_KEY responde 503 sem chamar fetch nem alterar o item", async () => {
    findUniqueMock.mockResolvedValue(row());
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(priceRequest(), params("item-1"));

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: "price_source_unavailable",
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("falha do provedor responde 502 sem alterar o item", async () => {
    process.env.PRICE_SEARCH_API_KEY = "chave";
    findUniqueMock.mockResolvedValue(row());
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response("nope", { status: 500 }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(priceRequest(), params("item-1"));

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "price_source_failed" });
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("timeout do provedor responde 502 sem alterar o item", async () => {
    process.env.PRICE_SEARCH_API_KEY = "chave";
    findUniqueMock.mockResolvedValue(row());
    vi.useFakeTimers();
    const fetchMock = vi.fn(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener("abort", () =>
            reject(new Error("aborted")),
          );
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const promise = POST(priceRequest(), params("item-1"));
    await vi.advanceTimersByTimeAsync(5010);
    const response = await promise;

    expect(response.status).toBe(502);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("sem preços válidos mantém o preço anterior e responde 200 com updated:false", async () => {
    process.env.PRICE_SEARCH_API_KEY = "chave";
    findUniqueMock.mockResolvedValue(row({ estimatedUnitPriceCents: 500 }));
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        searchResponse([{ extracted_price: 0 }, { price: "indisponível" }]),
      );
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(priceRequest(), params("item-1"));

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      updated: boolean;
      item: { estimatedUnitPriceCents: number };
    };
    expect(body.updated).toBe(false);
    expect(body.item.estimatedUnitPriceCents).toBe(500);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("responde 404 para item inexistente sem pesquisar", async () => {
    process.env.PRICE_SEARCH_API_KEY = "chave";
    findUniqueMock.mockResolvedValue(null);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(priceRequest(), params("ausente"));

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Item não encontrado" });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(updateMock).not.toHaveBeenCalled();
  });
});
