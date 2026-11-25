import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { firstErrorMessage, reserveSnapshotSchema } from "@/lib/validation";

export const runtime = "nodejs";

const SAVE_FAILURE_MESSAGE = "Não foi possível salvar o saldo";

/**
 * Confirma (upsert por `monthKey`) o saldo guardado da família.
 *
 * O valor é a fonte de verdade da reserva de emergência; a sobra do período é
 * uma estimativa de fluxo. `amountCents: 0` é válido ("não tenho reserva").
 */
export async function POST(request: Request): Promise<NextResponse> {
  const body = await request.json().catch(() => null);
  const parsed = reserveSnapshotSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: firstErrorMessage(parsed.error) },
      { status: 400 },
    );
  }

  const { monthKey, amountCents, note } = parsed.data;

  try {
    const snapshot = await prisma.reserveSnapshot.upsert({
      where: { monthKey },
      create: { monthKey, amountCents, note: note ?? null },
      update: { amountCents, note: note ?? null },
    });

    return NextResponse.json({
      monthKey: snapshot.monthKey,
      amountCents: snapshot.amountCents,
    });
  } catch {
    return NextResponse.json(
      { error: SAVE_FAILURE_MESSAGE },
      { status: 500 },
    );
  }
}
