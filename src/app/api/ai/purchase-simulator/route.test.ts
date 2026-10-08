import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const originalKey = process.env.DEEPSEEK_API_KEY;

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/ai/purchase-simulator", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const validPayload = {
  freeBudgetCents: 200000,
  dailyCents: 25000,
  remainingDays: 8,
  usualDailySpendCents: 20000,
  purchaseCents: 30000,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  delete process.env.DEEPSEEK_API_KEY;
});

afterEach(() => {
  vi.unstubAllGlobals();
  if (originalKey === undefined) delete process.env.DEEPSEEK_API_KEY;
  else process.env.DEEPSEEK_API_KEY = originalKey;
});

describe("POST /api/ai/purchase-simulator", () => {
  it("responde 200 com veredito local e sem fetch quando não há chave", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(jsonRequest(validPayload));

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      verdict: string;
      summary: string;
      source: string;
    };
    expect(body.verdict).toBe("ok");
    expect(body.summary).toContain("ritmo recente");
    expect(body.source).toBe("local");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("usa a justificativa da IA quando há chave e fetch válido", async () => {
    process.env.DEEPSEEK_API_KEY = "chave";
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ choices: [{ message: { content: "Justificativa IA" } }] }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(jsonRequest(validPayload));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      verdict: "ok",
      summary: "Justificativa IA",
      source: "ai",
    });
  });

  it("mantém source local quando a resposta da IA vem vazia", async () => {
    process.env.DEEPSEEK_API_KEY = "chave";
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ choices: [{ message: { content: "" } }] }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(jsonRequest(validPayload));

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      verdict: string;
      summary: string;
      source: string;
    };
    expect(body.verdict).toBe("ok");
    expect(body.summary).toContain("ritmo recente");
    expect(body.source).toBe("local");
  });

  it("mantém o fallback local quando a LLM falha (ainda 200)", async () => {
    process.env.DEEPSEEK_API_KEY = "chave";
    const fetchMock = vi.fn().mockRejectedValue(new Error("boom"));
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(jsonRequest(validPayload));

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      verdict: string;
      summary: string;
      source: string;
    };
    expect(body.verdict).toBe("ok");
    expect(body.summary).toContain("ritmo recente");
    expect(body.source).toBe("local");
  });

  it("rejeita payload inválido", async () => {
    const response = await POST(
      jsonRequest({ ...validPayload, purchaseCents: 0 }),
    );
    expect(response.status).toBe(400);
  });

  it("aceita usualDailySpendCents nulo (sem ritmo medido)", async () => {
    const response = await POST(
      jsonRequest({ ...validPayload, usualDailySpendCents: null }),
    );

    expect(response.status).toBe(200);
    expect((await response.json()).verdict).toBe("ok");
  });
});
