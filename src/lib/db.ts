import { PrismaClient } from "@prisma/client";
import { monthKey } from "./finance";
import {
  ensureClosedMonthSnapshots,
  isSnapshotTrigger,
} from "./snapshot-capture";
import { SNAPSHOT_AUTO_MONTHS } from "./snapshots";

/**
 * Client estendido que captura meses fechados **depois de qualquer mutação**
 * nos modelos de domínio (o "write em qualquer mês" fecha o mês que virou).
 * A captura roda sobre o client base, então as escritas nas tabelas de
 * snapshot não reativam o gancho e falhas nela nunca derrubam a mutação
 * original.
 */
function buildExtendedClient(base: PrismaClient) {
  return base.$extends({
    name: "captura-meses-fechados",
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const result = await query(args);
          if (isSnapshotTrigger(model, operation)) {
            await captureClosedMonthsSafe(base);
          }
          return result;
        },
      },
    },
  });
}

/** Uma verificação por mês corrente por processo (a captura é idempotente). */
let lastCapturedMonthKey: string | null = null;

/**
 * Captura os meses fechados ausentes, engolindo erros: snapshot é dado
 * derivado, a escrita/leitura do usuário não pode falhar por causa dele.
 * Não memoiza quando houve mês fechado vazio — um lançamento retroativo
 * posterior precisa poder criá-lo.
 */
async function captureClosedMonthsSafe(base: PrismaClient): Promise<void> {
  const current = monthKey(new Date());
  if (lastCapturedMonthKey === current) return;

  try {
    const result = await ensureClosedMonthSnapshots(base, {
      months: SNAPSHOT_AUTO_MONTHS,
    });
    if (result.empty.length === 0) lastCapturedMonthKey = current;
  } catch (error) {
    console.error(
      "Falha ao capturar snapshots de meses fechados:",
      error instanceof Error ? error.message : error,
    );
  }
}

const globalForPrisma = globalThis as unknown as {
  prisma?: ReturnType<typeof buildExtendedClient>;
  prismaBase?: PrismaClient;
};

// Sob testes, as suítes de integração usam um PostgreSQL dedicado apontado por
// TEST_DATABASE_URL (nunca SQLite); fora de testes a conexão segue DATABASE_URL.
const testDatabaseUrl =
  process.env.NODE_ENV === "test" ? process.env.TEST_DATABASE_URL : undefined;

const basePrisma =
  globalForPrisma.prismaBase ??
  new PrismaClient({
    ...(testDatabaseUrl
      ? { datasources: { db: { url: testDatabaseUrl } } }
      : {}),
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

export const prisma = globalForPrisma.prisma ?? buildExtendedClient(basePrisma);

/**
 * Rede de segurança de leitura: garante os snapshots dos meses fechados sem
 * depender de escrita nem de cron. Nunca lança.
 */
export function captureClosedMonths(): Promise<void> {
  return captureClosedMonthsSafe(basePrisma);
}

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
  globalForPrisma.prismaBase = basePrisma;
}
