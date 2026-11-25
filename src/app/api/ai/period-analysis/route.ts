import { NextResponse } from "next/server";
import {
  loadCycleDashboardData,
  resolveCycleReference,
} from "@/lib/dashboard";
import { loadPeriodAnalysis } from "@/lib/period-analysis-data";
import { chatCompletion, isAiConfigured } from "@/lib/ai/deepseek";
import {
  buildPeriodAiFactSheet,
  buildPeriodAiPrompt,
  localPeriodAiNarrative,
  parsePeriodAiNarrative,
} from "@/lib/ai/period-narrative";
import { getSettings } from "@/lib/settings";

export const runtime = "nodejs";

const MONTH_KEY_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * Narrativa por IA do diagnóstico de período.
 *
 * Carrega o ciclo **corrente** no servidor, monta o fact sheet anônimo e chama
 * a DeepSeek em modo JSON. Sem chave, falha de rede ou resposta inválida,
 * responde `200` com a narrativa determinística local (`source: "local"`).
 * Somente números, rótulos de categoria e ids opacos são enviados; nomes de
 * estabelecimentos, descrições e nomes de contas nunca saem do processo.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const body = await request.json().catch(() => null);
  const requested: unknown = body?.monthKey;

  if (typeof requested !== "string" || !MONTH_KEY_REGEX.test(requested)) {
    return NextResponse.json({ error: "invalid_month" }, { status: 400 });
  }

  const { cycleStartDay } = await getSettings();
  const reference = resolveCycleReference(
    requested,
    new Date(),
    cycleStartDay,
  );
  if (!reference.isCurrent) {
    return NextResponse.json(
      { error: "month_not_current" },
      { status: 400 },
    );
  }

  let analysis;
  try {
    const data = await loadCycleDashboardData(reference);
    if (!data.hasMovements) {
      return NextResponse.json({ error: "no_data" }, { status: 400 });
    }
    analysis = await loadPeriodAnalysis({ data, reference });
  } catch {
    return NextResponse.json(
      { error: "analysis_unavailable" },
      { status: 503 },
    );
  }

  if (analysis.period.monthsCount === 0) {
    return NextResponse.json({ error: "no_data" }, { status: 400 });
  }

  const local = localPeriodAiNarrative(analysis);

  if (!isAiConfigured()) {
    return NextResponse.json({ ...local, source: "local" });
  }

  try {
    const factSheet = buildPeriodAiFactSheet(analysis);
    const content = await chatCompletion(buildPeriodAiPrompt(factSheet), {
      responseFormat: "json_object",
      temperature: 0.3,
      maxTokens: 800,
      timeoutMs: 10000,
    });
    const narrative = parsePeriodAiNarrative(content, factSheet.factIds);
    if (narrative === null) {
      return NextResponse.json({ ...local, source: "local" });
    }
    return NextResponse.json({ ...narrative, source: "ai" });
  } catch {
    return NextResponse.json({ ...local, source: "local" });
  }
}
