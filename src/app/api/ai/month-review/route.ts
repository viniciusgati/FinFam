import { NextResponse } from "next/server";
import { loadDashboardData } from "@/lib/dashboard";
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
import { monthKey as monthKeyOf } from "@/lib/finance";
import { resolveReferenceDate } from "@/lib/invoices";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

const MONTH_KEY_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * Avalia um mês fechado.
 *
 * Ordem: valida formato → recusa mês corrente → exige chave da IA → usa o cache
 * `MonthlyReview` → gera (e cacheia) a avaliação. Somente números são enviados
 * à DeepSeek; qualquer falha cai na avaliação determinística local.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const body = await request.json().catch(() => null);
  const requested: unknown = body?.monthKey;

  if (typeof requested !== "string" || !MONTH_KEY_REGEX.test(requested)) {
    return NextResponse.json({ error: "invalid_month" }, { status: 400 });
  }
  const monthKey = requested;

  if (monthKey >= monthKeyOf(new Date())) {
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

  const data = await loadDashboardData(resolveReferenceDate(monthKey));
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
