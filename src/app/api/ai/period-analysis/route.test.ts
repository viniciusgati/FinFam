import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/dashboard", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/dashboard")>();
  return { ...actual, loadCycleDashboardData: vi.fn() };
});

vi.mock("@/lib/period-analysis-data", () => ({
  loadPeriodAnalysis: vi.fn(),
}));

vi.mock("@/lib/settings", () => ({
  getSettings: vi.fn(async () => ({ cycleStartDay: 1 })),
}));

import { loadCycleDashboardData } from "@/lib/dashboard";
import { loadPeriodAnalysis } from "@/lib/period-analysis-data";
import { monthKey, shiftMonthKey } from "@/lib/finance";
import { buildPeriodAnalysis } from "@/lib/period-analysis";
import { POST } from "./route";

const loadCycleDashboardDataMock = loadCycleDashboardData as unknown as ReturnType<
  typeof vi.fn
>;
const loadPeriodAnalysisMock = loadPeriodAnalysis as unknown as ReturnType<
  typeof vi.fn
>;

const currentMonth = monthKey(new Date());

function at(isoDate: string): Date {
  return new Date(`${isoDate}T12:00:00.000Z`);
}

function buildFixtureAnalysis() {
  const months = ["2026-04"].map((monthKey) => ({
    monthKey,
    incomeCents: 100000,
    consumedCents: 80000,
    fixedExpensesCents: 50000,
    variableExpensesCents: 30000,
    cardExpensesCents: 0,
    categories: [
      { category: "Alimentação", amountCents: 30000 },
      { category: "Casa", amountCents: 50000 },
    ],
    variableDailyCents: Array.from({ length: 30 }, (_, index) =>
      index === 9 ? 30000 : 0,
    ),
    daysInMonth: 30,
    elapsedDay: 30,
  }));

  return buildPeriodAnalysis({
    months,
    current: {
      monthKey: "2026-05",
      incomeCents: 100000,
      consumedCents: 90000,
      fixedExpensesCents: 50000,
      variableExpensesCents: 30000,
      cardExpensesCents: 10000,
      categories: [
        { category: "Alimentação", amountCents: 40000 },
        { category: "Casa", amountCents: 50000 },
      ],
      variableDailyCents: Array.from({ length: 31 }, (_, index) =>
        index === 9 ? 30000 : 0,
      ),
      daysInMonth: 31,
      elapsedDay: 15,
      isCurrent: true,
    },
    transactions: [
      ...[5, 10, 15, 20].map((day) => ({
        description: "iFood",
        amountCents: 5500,
        date: at(`2026-04-${String(day).padStart(2, "0")}`),
        category: "Alimentação",
        source: "variable" as const,
        paymentMethod: "PIX" as const,
      })),
      ...[1, 5, 10, 15].map((day) => ({
        description: "iFood",
        amountCents: 5500,
        date: at(`2026-05-${String(day).padStart(2, "0")}`),
        category: "Alimentação",
        source: "variable" as const,
        paymentMethod: "PIX" as const,
      })),
    ],
    fixedExpenses: [
      {
        name: "Aluguel",
        amountCents: 50000,
        dueDay: 10,
        category: "Moradia",
      },
    ],
    incomes: [{ name: "Salário", amountCents: 100000, receiveDay: 5 }],
    cards: [
      {
        id: "card-1",
        name: "Cartão principal",
        closingDay: 20,
        dueDay: 5,
        limitCents: 500000,
      },
    ],
    cardPurchases: [
      {
        description: "Notebook",
        amountCents: 90000,
        purchaseDate: at("2026-05-10"),
        category: "Casa",
        cardId: "card-1",
        card: { closingDay: 20, dueDay: 5 },
        installmentsTotal: 3,
      },
    ],
    referenceMonthKey: "2026-05",
  });
}

const analysis = buildFixtureAnalysis();
const originalKey = process.env.DEEPSEEK_API_KEY;

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/ai/period-analysis", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  delete process.env.DEEPSEEK_API_KEY;
  loadCycleDashboardDataMock.mockResolvedValue({ hasMovements: true });
  loadPeriodAnalysisMock.mockResolvedValue(analysis);
});

afterEach(() => {
  vi.unstubAllGlobals();
  if (originalKey === undefined) delete process.env.DEEPSEEK_API_KEY;
  else process.env.DEEPSEEK_API_KEY = originalKey;
});

describe("POST /api/ai/period-analysis", () => {
  it("rejeita monthKey inválido e mês não corrente", async () => {
    const invalid = await POST(jsonRequest({ monthKey: "2026-13" }));
    expect(invalid.status).toBe(400);

    const closed = await POST(
      jsonRequest({ monthKey: shiftMonthKey(currentMonth, -1) }),
    );
    expect(closed.status).toBe(400);
    expect(await closed.json()).toEqual({ error: "month_not_current" });
  });

  it("sem chave responde 200 com narrativa local e não vai à rede", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(jsonRequest({ monthKey: currentMonth }));

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      summary: string;
      actions: { factId: string; text: string }[];
      source: string;
    };
    expect(body.source).toBe("local");
    expect(body.summary).toContain("Sobra média");
    expect(body.actions[0].text).toContain("iFood");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("com chave responde 200 com a IA e envia apenas fatos anônimos", async () => {
    process.env.DEEPSEEK_API_KEY = "chave";
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  summary: "Resumo da IA",
                  actions: [
                    { factId: "lever-0", text: "Cortar uma compra." },
                  ],
                }),
              },
            },
          ],
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(jsonRequest({ monthKey: currentMonth }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      summary: "Resumo da IA",
      actions: [{ factId: "lever-0", text: "Cortar uma compra." }],
      source: "ai",
    });

    const [, init] = fetchMock.mock.calls[0];
    const sent = JSON.parse(String((init as RequestInit).body)) as {
      response_format: { type: string };
      temperature: number;
      max_tokens: number;
      messages: { role: string; content: string }[];
    };
    expect(sent.response_format).toEqual({ type: "json_object" });
    expect(sent.temperature).toBe(0.3);
    expect(sent.max_tokens).toBe(800);

    const user = sent.messages.find((message) => message.role === "user");
    const content = user?.content ?? "";
    expect(content).toContain("lever-0");
    expect(content).not.toContain("iFood");
    expect(content).not.toContain("Notebook");
    expect(content).not.toContain("Aluguel");
  });

  it("cai na narrativa local quando a IA devolve JSON inválido ou falha", async () => {
    process.env.DEEPSEEK_API_KEY = "chave";
    const invalid = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ choices: [{ message: { content: "não é json" } }] }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", invalid);

    const first = await POST(jsonRequest({ monthKey: currentMonth }));
    expect(first.status).toBe(200);
    expect((await first.json()).source).toBe("local");

    const failing = vi.fn().mockRejectedValue(new Error("boom"));
    vi.stubGlobal("fetch", failing);
    const second = await POST(jsonRequest({ monthKey: currentMonth }));
    expect(second.status).toBe(200);
    expect((await second.json()).source).toBe("local");
  });

  it("responde 400 sem movimentação e 503 se a análise não carregar", async () => {
    loadCycleDashboardDataMock.mockResolvedValueOnce({ hasMovements: false });
    const empty = await POST(jsonRequest({ monthKey: currentMonth }));
    expect(empty.status).toBe(400);
    expect(await empty.json()).toEqual({ error: "no_data" });

    loadPeriodAnalysisMock.mockRejectedValueOnce(new Error("db"));
    const failed = await POST(jsonRequest({ monthKey: currentMonth }));
    expect(failed.status).toBe(503);
    expect(await failed.json()).toEqual({ error: "analysis_unavailable" });
  });
});
