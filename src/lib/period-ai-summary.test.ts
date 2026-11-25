import { describe, expect, it, vi } from "vitest";
import {
  fetchPeriodAiSummary,
  PERIOD_AI_BUTTON_LABEL,
  PERIOD_AI_ERROR_MESSAGE,
  PERIOD_AI_LOADING_LABEL,
  PERIOD_AI_LOADING_MESSAGE,
  PERIOD_AI_LOCAL_NOTE,
} from "./period-ai-summary";

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

describe("fetchPeriodAiSummary", () => {
  it("devolve a narrativa da IA validada", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      response({
        summary: "Resumo da IA",
        actions: [{ factId: "lever-0", text: "Cortar 1 compra." }],
        source: "ai",
      }),
    );

    const outcome = await fetchPeriodAiSummary({
      monthKey: "2026-05",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(outcome).toEqual({
      data: {
        summary: "Resumo da IA",
        actions: [{ factId: "lever-0", text: "Cortar 1 compra." }],
        source: "ai",
      },
      error: false,
    });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("/api/ai/period-analysis");
    expect(JSON.parse(String((init as RequestInit).body))).toEqual({
      monthKey: "2026-05",
    });
  });

  it("aceita o fallback local do servidor", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      response({ summary: "Resumo local", actions: [], source: "local" }),
    );

    const outcome = await fetchPeriodAiSummary({
      monthKey: "2026-05",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(outcome.data?.source).toBe("local");
    expect(outcome.data?.summary).toBe("Resumo local");
  });

  it("filtra ações inválidas e limita a três", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      response({
        summary: "Resumo",
        actions: [
          { factId: "lever-0", text: "A" },
          { factId: "", text: "B" },
          { factId: "lever-1", text: "C" },
          { factId: "lever-2", text: "D" },
          { factId: "lever-3", text: "E" },
        ],
        source: "ai",
      }),
    );

    const outcome = await fetchPeriodAiSummary({
      monthKey: "2026-05",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(outcome.data?.actions).toEqual([
      { factId: "lever-0", text: "A" },
      { factId: "lever-1", text: "C" },
      { factId: "lever-2", text: "D" },
    ]);
  });

  it("vira erro em status não-2xx, JSON inválido ou contrato quebrado", async () => {
    const statusError = vi.fn().mockResolvedValue(response({ error: "x" }, 503));
    expect(
      await fetchPeriodAiSummary({
        monthKey: "2026-05",
        fetchImpl: statusError as unknown as typeof fetch,
      }),
    ).toEqual({ data: null, error: true });

    const invalidJson = vi.fn().mockResolvedValue(new Response("nope"));
    expect(
      await fetchPeriodAiSummary({
        monthKey: "2026-05",
        fetchImpl: invalidJson as unknown as typeof fetch,
      }),
    ).toEqual({ data: null, error: true });

    const broken = vi.fn().mockResolvedValue(
      response({ summary: "", actions: [], source: "ai" }),
    );
    expect(
      await fetchPeriodAiSummary({
        monthKey: "2026-05",
        fetchImpl: broken as unknown as typeof fetch,
      }),
    ).toEqual({ data: null, error: true });
  });

  it("vira erro quando a rede lança", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("boom"));
    expect(
      await fetchPeriodAiSummary({
        monthKey: "2026-05",
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).toEqual({ data: null, error: true });
  });

  it("expõe os textos exatos do bloco", () => {
    expect(PERIOD_AI_BUTTON_LABEL).toBe("Gerar análise com IA");
    expect(PERIOD_AI_LOADING_LABEL).toBe("Analisando o período…");
    expect(PERIOD_AI_LOADING_MESSAGE).toBe("Gerando análise com IA…");
    expect(PERIOD_AI_LOCAL_NOTE).toBe(
      "Resultado calculado localmente, sem IA.",
    );
    expect(PERIOD_AI_ERROR_MESSAGE).toBe(
      "Análise por IA indisponível no momento",
    );
  });
});
