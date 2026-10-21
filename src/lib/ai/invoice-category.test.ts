import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildInvoiceClassificationPrompt,
  classifyInvoiceTitles,
  normalizeInvoiceTitle,
  parseClassificationResponse,
  stripIofPrefix,
} from "./invoice-category";

type FetchImpl = (url: string, init: RequestInit) => Promise<Response>;

function aiResponse(content: string): Response {
  return new Response(JSON.stringify({ choices: [{ message: { content } }] }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function makeFetch(impl: FetchImpl = async () => aiResponse("[]")) {
  return vi.fn(impl);
}

const KEY_OPTIONS = { env: { DEEPSEEK_API_KEY: "chave" } };

afterEach(() => {
  vi.restoreAllMocks();
});

describe("normalizeInvoiceTitle / stripIofPrefix", () => {
  it("normaliza espaços e remove o prefixo IOF de", () => {
    expect(normalizeInvoiceTitle("  Netflix.   Com ")).toBe("Netflix. Com");
    expect(stripIofPrefix('IOF de "Opencode"')).toBe('"Opencode"');
    expect(stripIofPrefix('iof de  "Opencode"')).toBe('"Opencode"');
    expect(stripIofPrefix("Netflix.Com")).toBe("Netflix.Com");
  });
});

describe("classifyInvoiceTitles — match local", () => {
  it("devolve a categoria do histórico com fetch intocado", async () => {
    const fetchImpl = makeFetch();
    const existing = new Map([
      ["Netflix.Com", "Streaming"],
      ["  Mercado Pão e Cia ", "Mercado"],
    ]);

    const result = await classifyInvoiceTitles(
      ["NETFLIX.COM", "Mercado   Pão e Cia"],
      ["Mercado", "Streaming"],
      existing,
      { ...KEY_OPTIONS, fetchImpl: fetchImpl as unknown as typeof fetch },
    );

    expect(result).toEqual(["Streaming", "Mercado"]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("casa com e sem o prefixo IOF de nas duas pontas", async () => {
    const fetchImpl = makeFetch();
    const existing = new Map([['IOF de "Opencode"', "Lazer"]]);

    const result = await classifyInvoiceTitles(
      ['"Opencode"'],
      ["Lazer"],
      existing,
      { ...KEY_OPTIONS, fetchImpl: fetchImpl as unknown as typeof fetch },
    );

    expect(result).toEqual(["Lazer"]);
    expect(fetchImpl).not.toHaveBeenCalled();

    const reverse = await classifyInvoiceTitles(
      ['IOF de "Opencode"'],
      ["Lazer"],
      new Map([['"Opencode"', "Lazer"]]),
      { ...KEY_OPTIONS, fetchImpl: fetchImpl as unknown as typeof fetch },
    );

    expect(reverse).toEqual(["Lazer"]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("categoria vazia no histórico não casa (segue pendente)", async () => {
    const fetchImpl = makeFetch(async () => aiResponse('["Mercado"]'));
    const existing = new Map([["Loja X", null]]);

    const result = await classifyInvoiceTitles(
      ["Loja X"],
      ["Mercado"],
      existing,
      { ...KEY_OPTIONS, fetchImpl: fetchImpl as unknown as typeof fetch },
    );

    expect(result).toEqual(["Mercado"]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("sem pendências não faz chamada nenhuma", async () => {
    const fetchImpl = makeFetch();
    const existing = new Map([["Netflix.Com", "Streaming"]]);

    const result = await classifyInvoiceTitles(
      ["Netflix.Com"],
      ["Streaming"],
      existing,
      { ...KEY_OPTIONS, fetchImpl: fetchImpl as unknown as typeof fetch },
    );

    expect(result).toEqual(["Streaming"]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe("classifyInvoiceTitles — DeepSeek em lote", () => {
  it("faz exatamente UMA chamada com todos os títulos pendentes e rótulos deduplicados sem Ajuste", async () => {
    const fetchImpl = makeFetch(async () =>
      aiResponse('["Mercado", "Lazer", null]'),
    );
    const existing = new Map([["Netflix.Com", "Streaming"]]);

    const result = await classifyInvoiceTitles(
      ["Netflix.Com", "Padaria da Esquina", "Cinema Inox", "IOF de \"Banco\""],
      ["Mercado", "mercado", "Lazer", "Ajuste", "Streaming"],
      existing,
      { ...KEY_OPTIONS, fetchImpl: fetchImpl as unknown as typeof fetch },
    );

    expect(result).toEqual(["Streaming", "Mercado", "Lazer", null]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    const [, init] = fetchImpl.mock.calls[0];
    const body = JSON.parse(String(init.body)) as {
      messages: { role: string; content: string }[];
    };
    const user = JSON.parse(body.messages[1].content) as {
      titles: string[];
      labels: string[];
    };
    expect(user.titles).toEqual([
      "Padaria da Esquina",
      "Cinema Inox",
      'IOF de "Banco"',
    ]);
    expect(user.labels).toEqual(["Lazer", "Mercado", "Streaming"]);
    expect(user.labels).not.toContain("Ajuste");
  });

  it("rótulo fora da lista vira null sem invalidar os demais", async () => {
    const fetchImpl = makeFetch(async () =>
      aiResponse('["Mercado", "Viagem", 42]'),
    );

    const result = await classifyInvoiceTitles(
      ["Padaria", "Cinema", "Loja Variada"],
      ["Mercado", "Lazer"],
      new Map(),
      { ...KEY_OPTIONS, fetchImpl: fetchImpl as unknown as typeof fetch },
    );

    expect(result).toEqual(["Mercado", null, null]);
  });

  it("resposta inválida (não-JSON / cercada em ``` ) não propaga exceção", async () => {
    const fetchImpl = makeFetch(async () => aiResponse("não é json"));

    const result = await classifyInvoiceTitles(
      ["Padaria"],
      ["Mercado"],
      new Map(),
      { ...KEY_OPTIONS, fetchImpl: fetchImpl as unknown as typeof fetch },
    );

    expect(result).toEqual([null]);

    const fenced = makeFetch(async () => aiResponse('```json\n["Mercado"]\n```'));
    const fencedResult = await classifyInvoiceTitles(
      ["Padaria"],
      ["Mercado"],
      new Map(),
      { ...KEY_OPTIONS, fetchImpl: fenced as unknown as typeof fetch },
    );
    expect(fencedResult).toEqual(["Mercado"]);
  });

  it("falha de rede vira null por título sem exceção", async () => {
    const fetchImpl = makeFetch(async () => {
      throw new Error("rede indisponível");
    });

    const result = await classifyInvoiceTitles(
      ["Padaria", "Cinema"],
      ["Mercado", "Lazer"],
      new Map(),
      { ...KEY_OPTIONS, fetchImpl: fetchImpl as unknown as typeof fetch },
    );

    expect(result).toEqual([null, null]);
  });

  it("sem chave não chama a rede e devolve null por título", async () => {
    const fetchImpl = makeFetch();

    const result = await classifyInvoiceTitles(
      ["Padaria"],
      ["Mercado"],
      new Map(),
      { env: {}, fetchImpl: fetchImpl as unknown as typeof fetch },
    );

    expect(result).toEqual([null]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("sem sugestões de categoria (só Ajuste) não chama a IA", async () => {
    const fetchImpl = makeFetch();

    const result = await classifyInvoiceTitles(
      ["Padaria"],
      ["Ajuste"],
      new Map(),
      { ...KEY_OPTIONS, fetchImpl: fetchImpl as unknown as typeof fetch },
    );

    expect(result).toEqual([null]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("mantém a ordem das entradas mesmo com match local no meio", async () => {
    const fetchImpl = makeFetch(async () => aiResponse('["Lazer", "Lazer"]'));
    const existing = new Map([["Uber Trip", "Transporte"]]);

    const result = await classifyInvoiceTitles(
      ["iFood", "Uber Trip", "Cinema"],
      ["Lazer", "Transporte"],
      existing,
      { ...KEY_OPTIONS, fetchImpl: fetchImpl as unknown as typeof fetch },
    );

    expect(result).toEqual(["Lazer", "Transporte", "Lazer"]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});

describe("parseClassificationResponse", () => {
  it("devolve o rótulo canônico da lista (case-insensitive) ou null", () => {
    expect(parseClassificationResponse('["mercado", null]', ["Mercado"], 2)).toEqual([
      "Mercado",
      null,
    ]);
    expect(parseClassificationResponse('["Mercado"]', ["Mercado"], 2)).toEqual([
      "Mercado",
      null,
    ]);
    expect(parseClassificationResponse("[1,2]", ["Mercado"], 2)).toEqual([
      null,
      null,
    ]);
    expect(parseClassificationResponse("{}", ["Mercado"], 2)).toEqual([
      null,
      null,
    ]);
  });
});

describe("buildInvoiceClassificationPrompt", () => {
  it("envia apenas títulos e rótulos no user (exceção §7: só isso trafega)", () => {
    const [system, user] = buildInvoiceClassificationPrompt(
      ["Padaria"],
      ["Mercado"],
    );

    expect(system.role).toBe("system");
    expect(user.role).toBe("user");
    const parsed = JSON.parse(user.content) as Record<string, unknown>;
    expect(Object.keys(parsed).sort()).toEqual(["labels", "titles"]);
    expect(parsed.titles).toEqual(["Padaria"]);
    expect(parsed.labels).toEqual(["Mercado"]);
  });
});
