/**
 * Cliente da rota de narrativa por IA do diagnóstico de período.
 *
 * Função pura de I/O (recebe `fetchImpl`) para poder ser testada sem DOM. A
 * resposta é validada antes de chegar ao componente; qualquer falha vira
 * `error: true` e o card cai no texto local determinístico.
 */

import type { PeriodAiAction } from "./ai/period-narrative";

export type PeriodAiSummarySource = "ai" | "local";

export interface PeriodAiSummaryResponse {
  summary: string;
  actions: PeriodAiAction[];
  source: PeriodAiSummarySource;
}

export interface PeriodAiSummaryOutcome {
  data: PeriodAiSummaryResponse | null;
  error: boolean;
}

export const PERIOD_AI_BUTTON_LABEL = "Gerar análise com IA";
export const PERIOD_AI_LOADING_LABEL = "Analisando o período…";
export const PERIOD_AI_LOADING_MESSAGE = "Gerando análise com IA…";
export const PERIOD_AI_LOCAL_NOTE =
  "Resultado calculado localmente, sem IA.";
export const PERIOD_AI_ERROR_MESSAGE =
  "Análise por IA indisponível no momento";

interface FetchPeriodAiSummaryParams {
  monthKey: string;
  fetchImpl?: typeof fetch;
}

function parseAction(value: unknown): PeriodAiAction | null {
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;
  if (typeof record.factId !== "string" || !record.factId.trim()) {
    return null;
  }
  if (typeof record.text !== "string" || !record.text.trim()) {
    return null;
  }
  return { factId: record.factId.trim(), text: record.text.trim() };
}

/**
 * Chama a rota e devolve a narrativa validada. Nunca lança: rede, JSON
 * inválido, status ≠ 200 ou campos fora do contrato viram `error: true`.
 */
export async function fetchPeriodAiSummary(
  params: FetchPeriodAiSummaryParams,
): Promise<PeriodAiSummaryOutcome> {
  const doFetch =
    params.fetchImpl ??
    ((input: RequestInfo | URL, init?: RequestInit) => fetch(input, init));

  try {
    const response = await doFetch("/api/ai/period-analysis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ monthKey: params.monthKey }),
    });
    const body = (await response.json().catch(() => null)) as
      | Record<string, unknown>
      | null;

    if (!response.ok || body === null) {
      return { data: null, error: true };
    }

    const summary =
      typeof body.summary === "string" ? body.summary.trim() : "";
    const source = body.source;
    if (
      !summary ||
      (source !== "ai" && source !== "local") ||
      !Array.isArray(body.actions)
    ) {
      return { data: null, error: true };
    }

    const actions = body.actions
      .map(parseAction)
      .filter((action): action is PeriodAiAction => action !== null)
      .slice(0, 3);

    return {
      data: { summary, actions, source },
      error: false,
    };
  } catch {
    return { data: null, error: true };
  }
}
