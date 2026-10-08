import { NextResponse } from "next/server";
import { z } from "zod";
import {
  buildPurchasePrompt,
  simulatePurchase,
} from "@/lib/ai/purchase-simulator";
import { chatCompletion, isAiConfigured } from "@/lib/ai/deepseek";
import { firstErrorMessage } from "@/lib/validation";

export const runtime = "nodejs";

const simulateSchema = z.object({
  incomeCents: z.number().int().nonnegative(),
  spentCents: z.number().int().nonnegative(),
  elapsedDay: z.number().int().positive(),
  daysInMonth: z.number().int().positive(),
  purchaseCents: z.number().int().positive(),
  previousMonthsCents: z.array(z.number().int().nonnegative()).optional(),
});

/**
 * Simula uma compra.
 *
 * O veredito é sempre local e determinístico (rota responde `200`). A DeepSeek
 * só redige a justificativa — sem chave ou em falha, mantém-se o texto local.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const body = await request.json().catch(() => null);
  const parsed = simulateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: firstErrorMessage(parsed.error) },
      { status: 400 },
    );
  }

  const input = parsed.data;
  const simulation = simulatePurchase(input);
  let summary = simulation.summary;
  let source: "ai" | "local" = "local";

  if (isAiConfigured()) {
    try {
      const text = await chatCompletion(
        buildPurchasePrompt(input, simulation.verdict),
      );
      if (text) {
        summary = text;
        source = "ai";
      }
    } catch {
      // Falha da IA: mantém veredito + justificativa local.
    }
  }

  return NextResponse.json({
    verdict: simulation.verdict,
    summary,
    source,
  });
}
