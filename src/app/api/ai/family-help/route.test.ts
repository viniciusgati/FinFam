import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/dashboard", () => ({
  loadDashboardData: vi.fn(),
}));

import { loadDashboardData } from "@/lib/dashboard";
import { monthKey } from "@/lib/finance";
import { POST } from "./route";

const loadDashboardDataMock = loadDashboardData as unknown as ReturnType<
  typeof vi.fn
>;

const currentMonth = monthKey(new Date());

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/ai/family-help", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const dashboardData = {
  monthlyIncomeCents: 500000,
  fixedExpensesCents: 100000,
  categoryBreakdown: {
    monthKey: currentMonth,
    items: [{ category: "Mercado", amountCents: 30000 }],
    totalCents: 30000,
  },
  snapshots: [
    {
      monthKey: "2026-09",
      incomeCents: 500000,
      consumedCents: 0,
      consumedPercent: 0,
      categories: [{ category: "Mercado", amountCents: 25000 }],
    },
  ],
  series: {
    elapsedDay: 2,
    variableDailyCents: [1000, 2000, 0],
  },
  consumption: {
    dailyByMonthCents: 10000,
  },
};

const originalKey = process.env.DEEPSEEK_API_KEY;

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  delete process.env.DEEPSEEK_API_KEY;
  loadDashboardDataMock.mockResolvedValue(dashboardData);
});

afterEach(() => {
  vi.unstubAllGlobals();
  if (originalKey === undefined) delete process.env.DEEPSEEK_API_KEY;
  else process.env.DEEPSEEK_API_KEY = originalKey;
});

describe("POST /api/ai/family-help", () => {
  it("sem chave responde 503 e não vai à rede nem ao banco", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(jsonRequest({ monthKey: currentMonth }));

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "ai_unavailable" });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(loadDashboardDataMock).not.toHaveBeenCalled();
  });

  it("rejeita monthKey inválido com 400", async () => {
    const response = await POST(jsonRequest({ monthKey: "2026-13" }));
    expect(response.status).toBe(400);
  });

  it("com chave responde 200 com o resumo e envia apenas números anônimos", async () => {
    process.env.DEEPSEEK_API_KEY = "chave";
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ choices: [{ message: { content: "Resumo da IA" } }] }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(jsonRequest({ monthKey: currentMonth }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ summary: "Resumo da IA" });

    const [, init] = fetchMock.mock.calls[0];
    const sent = JSON.parse((init as RequestInit).body as string) as {
      messages: { role: string; content: string }[];
    };
    const user = sent.messages.find((message) => message.role === "user");
    expect(user?.content).not.toContain("Mercado");

    const parsed = JSON.parse(user?.content ?? "{}") as Record<string, unknown>;
    for (const value of Object.values(parsed)) {
      if (Array.isArray(value)) {
        expect(value.every((entry) => typeof entry === "number")).toBe(true);
      } else {
        expect(typeof value).toBe("number");
      }
    }
  });

  it("cai em 503 quando a IA falha", async () => {
    process.env.DEEPSEEK_API_KEY = "chave";
    const fetchMock = vi.fn().mockRejectedValue(new Error("boom"));
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(jsonRequest({ monthKey: currentMonth }));

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "ai_unavailable" });
  });
});
