import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AiUnavailableError,
  chatCompletion,
  DEFAULT_DEEPSEEK_API_URL,
  DEFAULT_DEEPSEEK_MODEL,
  isAiConfigured,
  resolveDeepSeekConfig,
} from "./deepseek";

function validResponse(): Response {
  return new Response(
    JSON.stringify({ choices: [{ message: { content: "  Olá  " } }] }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

type FetchImpl = (url: string, init: RequestInit) => Promise<Response>;

function makeFetch(impl: FetchImpl = async () => validResponse()) {
  return vi.fn(impl);
}

afterEach(() => {
  vi.useRealTimers();
});

describe("resolveDeepSeekConfig", () => {
  it("retorna null sem chave", () => {
    expect(resolveDeepSeekConfig({})).toBeNull();
    expect(resolveDeepSeekConfig({ DEEPSEEK_API_KEY: "   " })).toBeNull();
  });

  it("usa URL e modelo padrão quando não configurados", () => {
    expect(resolveDeepSeekConfig({ DEEPSEEK_API_KEY: "chave" })).toEqual({
      apiKey: "chave",
      apiUrl: DEFAULT_DEEPSEEK_API_URL,
      model: DEFAULT_DEEPSEEK_MODEL,
    });
  });

  it("respeita URL e modelo customizados", () => {
    expect(
      resolveDeepSeekConfig({
        DEEPSEEK_API_KEY: "chave",
        DEEPSEEK_API_URL: "http://localhost/v1/chat",
        DEEPSEEK_MODEL: "outro-modelo",
      }),
    ).toEqual({
      apiKey: "chave",
      apiUrl: "http://localhost/v1/chat",
      model: "outro-modelo",
    });
  });
});

describe("isAiConfigured", () => {
  it("reflete a presença da chave", () => {
    expect(isAiConfigured({})).toBe(false);
    expect(isAiConfigured({ DEEPSEEK_API_KEY: "k" })).toBe(true);
  });
});

describe("chatCompletion", () => {
  it("sem chave lança AiUnavailableError e não chama a rede", async () => {
    const fetchImpl = makeFetch();

    await expect(
      chatCompletion([{ role: "user", content: "{}" }], {
        env: {},
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).rejects.toBeInstanceOf(AiUnavailableError);

    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("envia URL, modelo e bearer configurados e devolve o conteúdo", async () => {
    const fetchImpl = makeFetch();

    const content = await chatCompletion(
      [{ role: "user", content: '{"a":1}' }],
      {
        env: {
          DEEPSEEK_API_KEY: "segredo",
          DEEPSEEK_API_URL: "https://exemplo.test/chat",
          DEEPSEEK_MODEL: "meu-modelo",
        },
        fetchImpl: fetchImpl as unknown as typeof fetch,
      },
    );

    expect(content).toBe("Olá");

    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://exemplo.test/chat");
    expect(init.headers).toMatchObject({ authorization: "Bearer segredo" });
    expect(JSON.parse(String(init.body))).toMatchObject({ model: "meu-modelo" });
  });

  it("lança erro em resposta não-2xx", async () => {
    const fetchImpl = makeFetch(async () => new Response("nope", { status: 500 }));

    await expect(
      chatCompletion([{ role: "user", content: "{}" }], {
        env: { DEEPSEEK_API_KEY: "k" },
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).rejects.toThrow("500");
  });

  it("lança erro quando a resposta não tem conteúdo", async () => {
    const fetchImpl = makeFetch(
      async () => new Response(JSON.stringify({ choices: [] }), { status: 200 }),
    );

    await expect(
      chatCompletion([{ role: "user", content: "{}" }], {
        env: { DEEPSEEK_API_KEY: "k" },
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).rejects.toThrow();
  });

  it("aborta por timeout via AbortController", async () => {
    vi.useFakeTimers();
    const fetchImpl = makeFetch(
      (url, init) =>
        new Promise<Response>((resolve, reject) => {
          void url;
          void resolve;
          init.signal?.addEventListener("abort", () =>
            reject(new Error("aborted")),
          );
        }),
    );

    const promise = chatCompletion([{ role: "user", content: "{}" }], {
      env: { DEEPSEEK_API_KEY: "k" },
      fetchImpl: fetchImpl as unknown as typeof fetch,
      timeoutMs: 50,
    });
    const assertion = expect(promise).rejects.toThrow("aborted");
    await vi.advanceTimersByTimeAsync(60);
    await assertion;
  });
});
