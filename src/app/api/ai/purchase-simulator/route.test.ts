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
  incomeCents: 100000,
  spentCents: 20000,
  elapsedDay: 10,
  daysInMonth: 30,
  purchaseCents: 30000,
  previousMonthsCents: [1000, 2000],
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
    const body = (await response.json()) as { verdict: string; summary: string };
    expect(body.verdict).toBe("ok");
    expect(body.summary).toContain("Pode comprar");
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
    });
  });

  it("mantém o fallback local quando a LLM falha (ainda 200)", async () => {
    process.env.DEEPSEEK_API_KEY = "chave";
    const fetchMock = vi.fn().mockRejectedValue(new Error("boom"));
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(jsonRequest(validPayload));

    expect(response.status).toBe(200);
    const body = (await response.json()) as { verdict: string; summary: string };
    expect(body.verdict).toBe("ok");
    expect(body.summary).toContain("Pode comprar");
  });

  it("rejeita payload inválido", async () => {
    const response = await POST(
      jsonRequest({ ...validPayload, purchaseCents: 0 }),
    );
    expect(response.status).toBe(400);
  });
});
