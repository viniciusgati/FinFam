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

  it("payload legado mantém o mesmo veredito", async () => {
    const legacy = await POST(jsonRequest(validPayload));
    const withDefaults = await POST(
      jsonRequest({
        ...validPayload,
        installmentsTotal: 1,
        savingsGoalCents: 0,
        savingsGoalSavedCents: 0,
      }),
    );

    expect(legacy.status).toBe(200);
    expect(withDefaults.status).toBe(200);
    const legacyBody = (await legacy.json()) as { verdict: string };
    const defaultsBody = (await withDefaults.json()) as { verdict: string };
    expect(legacyBody.verdict).toBe("ok");
    expect(defaultsBody.verdict).toBe(legacyBody.verdict);
  });

  it("aceita installmentsTotal 3 e reflete a 1ª parcela no prompt da IA", async () => {
    process.env.DEEPSEEK_API_KEY = "chave";
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ choices: [{ message: { content: "Justificativa IA" } }] }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      jsonRequest({
        ...validPayload,
        purchaseCents: 100000,
        installmentsTotal: 3,
        savingsGoalCents: 500000,
        savingsGoalSavedCents: 100000,
      }),
    );

    expect(response.status).toBe(200);
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    const sent = JSON.parse(String(init.body)) as {
      messages: { role: string; content: string }[];
    };
    const user = sent.messages.find((message) => message.role === "user");
    const data = JSON.parse(user?.content ?? "{}") as Record<string, unknown>;
    expect(data.installmentsTotal).toBe(3);
    expect(data.installmentCents).toBe(33334);
    expect(data.futureCommitmentCents).toBe(66666);
  });

  it.each([0, -1, 1.5, "3"])(
    "rejeita installmentsTotal inválido (%s) sem chamar a IA",
    async (installmentsTotal) => {
      process.env.DEEPSEEK_API_KEY = "chave";
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);

      const response = await POST(
        jsonRequest({ ...validPayload, installmentsTotal }),
      );

      expect(response.status).toBe(400);
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it("envia à IA apenas números mesmo com parcelas e meta preenchidas", async () => {
    process.env.DEEPSEEK_API_KEY = "chave";
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ choices: [{ message: { content: "Justificativa IA" } }] }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      jsonRequest({
        ...validPayload,
        installmentsTotal: 4,
        savingsGoalCents: 500000,
        savingsGoalSavedCents: 120000,
      }),
    );

    expect(response.status).toBe(200);
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    const sent = JSON.parse(String(init.body)) as {
      messages: { role: string; content: string }[];
    };
    const user = sent.messages.find((message) => message.role === "user");
    const data = JSON.parse(user?.content ?? "{}") as Record<string, unknown>;

    expect(Object.keys(data)).toEqual(
      expect.arrayContaining([
        "installmentsTotal",
        "installmentCents",
        "futureCommitmentCents",
        "savingsGoalCents",
        "savingsGoalSavedCents",
        "goalRemainingCents",
      ]),
    );
    for (const value of Object.values(data)) {
      expect(typeof value).toBe("number");
    }
  });
});
