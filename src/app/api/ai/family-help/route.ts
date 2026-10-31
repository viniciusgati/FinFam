import { NextResponse } from "next/server";
import {
  loadCycleDashboardData,
  resolveCycleReference,
} from "@/lib/dashboard";
import { chatCompletion, isAiConfigured } from "@/lib/ai/deepseek";
import {
  buildFamilyHelpData,
  buildFamilyHelpPrompt,
  buildFamilyInsightInput,
} from "@/lib/ai/family-help";
import { getSettings } from "@/lib/settings";

export const runtime = "nodejs";

const MONTH_KEY_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * Gera o resumo complementar da IA para o card "Ajuda à família".
 *
 * Recebe `{ monthKey }` (mês de início do ciclo), carrega os agregados **no
 * servidor** na mesma moldura do dashboard e envia à DeepSeek apenas números
 * anônimos (nenhum rótulo sai do processo). Sem chave ou em qualquer falha
 * responde `503 { error: "ai_unavailable" }`; o card cai no texto local
 * determinístico.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const body = await request.json().catch(() => null);
  const requested: unknown = body?.monthKey;

  if (typeof requested !== "string" || !MONTH_KEY_REGEX.test(requested)) {
    return NextResponse.json({ error: "invalid_month" }, { status: 400 });
  }

  if (!isAiConfigured()) {
    return NextResponse.json({ error: "ai_unavailable" }, { status: 503 });
  }

  try {
    const { cycleStartDay } = await getSettings();
    const reference = resolveCycleReference(requested, new Date(), cycleStartDay);
    const data = await loadCycleDashboardData(reference);

    const input = buildFamilyInsightInput({
      referenceMonthKey: reference.cycleKey,
      isCurrentCycle: reference.isCurrent,
      data,
    });

    const summary = await chatCompletion(
      buildFamilyHelpPrompt(buildFamilyHelpData(input)),
    );

    return NextResponse.json({ summary });
  } catch {
    return NextResponse.json({ error: "ai_unavailable" }, { status: 503 });
  }
}
