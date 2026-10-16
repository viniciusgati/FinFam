import { NextResponse } from "next/server";
import {
  loadCycleDashboardData,
  resolveCycleReference,
} from "@/lib/dashboard";
import {
  chatCompletion,
  isAiConfigured,
} from "@/lib/ai/deepseek";
import {
  buildMonthReviewData,
  buildMonthReviewPrompt,
  localMonthReview,
  monthReviewSnapshotFrom,
} from "@/lib/ai/month-review";
import { getSettings } from "@/lib/settings";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

const MONTH_KEY_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * Avalia um ciclo fechado (`monthKey` = mês de início do ciclo).
 *
 * Ordem: valida formato → recusa ciclo corrente/futuro → exige chave da IA →
 * usa o cache `MonthlyReview` → gera (e cacheia) a avaliação. Somente números
 * são enviados à DeepSeek; qualquer falha cai na avaliação determinística
 * local. O `monthKey` do cache é o próprio mês de início do ciclo.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const body = await request.json().catch(() => null);
  const requested: unknown = body?.monthKey;

  if (typeof requested !== "string" || !MONTH_KEY_REGEX.test(requested)) {
    return NextResponse.json({ error: "invalid_month" }, { status: 400 });
  }
  const monthKey = requested;

  const { cycleStartDay } = await getSettings();
  const reference = resolveCycleReference(monthKey, new Date(), cycleStartDay);
  if (reference.isCurrent || reference.isFuture) {
    return NextResponse.json({ error: "month_not_closed" }, { status: 400 });
  }

  if (!isAiConfigured()) {
    return NextResponse.json({ error: "ai_unavailable" }, { status: 503 });
  }

  const cached = await prisma.monthlyReview.findUnique({ where: { monthKey } });
  if (cached) {
    return NextResponse.json({
      monthKey,
      summary: cached.summary,
      cached: true,
    });
  }

  const data = await loadCycleDashboardData(reference);
  const reviewData = buildMonthReviewData(
    monthReviewSnapshotFrom(data),
    data.previousMonthsCents,
  );

  let summary: string;
  try {
    summary = await chatCompletion(buildMonthReviewPrompt(reviewData));
  } catch {
    summary = localMonthReview(reviewData);
  }

  await prisma.monthlyReview.upsert({
    where: { monthKey },
    create: { monthKey, summary },
    update: { summary },
  });

  return NextResponse.json({ monthKey, summary });
}
