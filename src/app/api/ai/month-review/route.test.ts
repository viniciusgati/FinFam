import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    monthlyReview: { findUnique: vi.fn(), upsert: vi.fn() },
  },
}));

vi.mock("@/lib/dashboard", () => ({
  loadDashboardData: vi.fn(),
}));

import { prisma } from "@/lib/db";
import { loadDashboardData } from "@/lib/dashboard";
import { monthKey, shiftMonthKey } from "@/lib/finance";
import { POST } from "./route";

const monthlyReviewMock = prisma.monthlyReview as unknown as {
  findUnique: ReturnType<typeof vi.fn>;
  upsert: ReturnType<typeof vi.fn>;
};
const loadDashboardDataMock = loadDashboardData as unknown as ReturnType<
  typeof vi.fn
>;

const currentMonth = monthKey(new Date());
const closedMonth = shiftMonthKey(currentMonth, -1);

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/ai/month-review", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const dashboardData = {
  monthlyIncomeCents: 500000,
  fixedExpensesCents: 100000,
  variableExpensesCents: 50000,
  cardExpensesCents: 20000,
  previousPercents: [],
  previousMonthsCents: [100000, 200000],
  series: {
    daysInMonth: 30,
    elapsedDay: 30,
    dailyExpensesCents: [] as number[],
    cumulativeExpensesCents: [] as number[],
    entriesCents: 500000,
    totalExpensesCents: 170000,
    dailyBudgetCents: 16667,
    projectedMonthEndCents: 170000,
  },
  referenceDate: new Date(),
};

const originalKey = process.env.DEEPSEEK_API_KEY;

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  delete process.env.DEEPSEEK_API_KEY;
  monthlyReviewMock.findUnique.mockResolvedValue(null);
  monthlyReviewMock.upsert.mockResolvedValue({});
  loadDashboardDataMock.mockResolvedValue(dashboardData);
});

afterEach(() => {
  vi.unstubAllGlobals();
  if (originalKey === undefined) delete process.env.DEEPSEEK_API_KEY;
  else process.env.DEEPSEEK_API_KEY = originalKey;
});

describe("POST /api/ai/month-review", () => {
  it("sem chave responde 503 e não vai à rede", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(jsonRequest({ monthKey: closedMonth }));

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "ai_unavailable" });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(monthlyReviewMock.findUnique).not.toHaveBeenCalled();
  });

  it("recusa o mês corrente com erro de negócio", async () => {
    process.env.DEEPSEEK_API_KEY = "chave";

    const response = await POST(jsonRequest({ monthKey: currentMonth }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "month_not_closed" });
    expect(loadDashboardDataMock).not.toHaveBeenCalled();
  });

  it("usa o cache sem novo fetch quando o mês já foi avaliado", async () => {
    process.env.DEEPSEEK_API_KEY = "chave";
    monthlyReviewMock.findUnique.mockResolvedValue({
      monthKey: closedMonth,
      summary: "Em cache",
    });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(jsonRequest({ monthKey: closedMonth }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      monthKey: closedMonth,
      summary: "Em cache",
      cached: true,
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(loadDashboardDataMock).not.toHaveBeenCalled();
  });

  it("gera, envia apenas números e grava o cache", async () => {
    process.env.DEEPSEEK_API_KEY = "chave";
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ choices: [{ message: { content: "Resumo da IA" } }] }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(jsonRequest({ monthKey: closedMonth }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      monthKey: closedMonth,
      summary: "Resumo da IA",
    });

    const [, init] = fetchMock.mock.calls[0];
    const sent = JSON.parse((init as RequestInit).body as string) as {
      messages: { role: string; content: string }[];
    };
    const user = sent.messages.find((message) => message.role === "user");
    const parsed = JSON.parse(user?.content ?? "{}") as Record<string, unknown>;
    for (const value of Object.values(parsed)) {
      expect(typeof value).toBe("number");
    }

    expect(monthlyReviewMock.upsert).toHaveBeenCalledWith({
      where: { monthKey: closedMonth },
      create: { monthKey: closedMonth, summary: "Resumo da IA" },
      update: { summary: "Resumo da IA" },
    });
  });

  it("cai no fallback local quando a IA falha", async () => {
    process.env.DEEPSEEK_API_KEY = "chave";
    const fetchMock = vi.fn().mockRejectedValue(new Error("boom"));
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(jsonRequest({ monthKey: closedMonth }));

    expect(response.status).toBe(200);
    const body = (await response.json()) as { summary: string };
    expect(body.summary.length).toBeGreaterThan(0);
    expect(monthlyReviewMock.upsert).toHaveBeenCalled();
  });

  it("rejeita monthKey inválido", async () => {
    const response = await POST(jsonRequest({ monthKey: "2026-13" }));
    expect(response.status).toBe(400);
  });
});
