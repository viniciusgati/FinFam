import { PrismaClient } from "@prisma/client";
import {
  ensureClosedMonthSnapshots,
  type EnsureSnapshotsResult,
} from "../src/lib/snapshot-capture";
import { SNAPSHOT_MAX_MONTHS } from "../src/lib/snapshots";

/**
 * Backfill e correção dos snapshots de meses fechados.
 *
 * - Sem flags: cria os snapshots **ausentes** dos últimos `SNAPSHOT_MAX_MONTHS`
 *   (60) meses fechados. Snapshots existentes nunca são tocados.
 * - `--force`: recalcula os meses alvo (janela default de 4 meses, ou
 *   `--months N`). Use para corrigir um mês fechado após ajuste de dados.
 * - `--month AAAA-MM`: processa um único mês (combinável com `--force`).
 */

interface CliOptions {
  force: boolean;
  month?: string;
  months: number;
}

function parseArgs(argv: string[]): CliOptions {
  const force = argv.includes("--force");

  const monthIndex = argv.indexOf("--month");
  let month: string | undefined;
  if (monthIndex >= 0) {
    month = argv[monthIndex + 1];
    if (!month) throw new Error("--month exige um valor no formato AAAA-MM.");
  }

  const monthsIndex = argv.indexOf("--months");
  const monthsArg = monthsIndex >= 0 ? Number(argv[monthsIndex + 1]) : undefined;
  if (monthsIndex >= 0 && (!Number.isFinite(monthsArg) || (monthsArg ?? 0) < 1)) {
    throw new Error("--months exige um inteiro ≥ 1.");
  }

  const envMonths = Number(process.env.SNAPSHOT_MONTHS);
  const envDefault =
    Number.isFinite(envMonths) && envMonths > 0 ? envMonths : undefined;
  // Sem `--force`, o default é o backfill máximo; com `--force`, uma janela
  // curta evita recalcular anos de histórico sem intenção.
  const fallback = envDefault ?? (force ? 4 : SNAPSHOT_MAX_MONTHS);

  return { force, month, months: monthsArg ?? fallback };
}

function report(options: CliOptions, result: EnsureSnapshotsResult): void {
  const lines: string[] = [];

  if (result.created.length > 0) {
    lines.push(`Snapshots criados: ${result.created.join(", ")}`);
  }
  if (result.recalculated.length > 0) {
    lines.push(`Snapshots recalculados: ${result.recalculated.join(", ")}`);
  }
  if (result.kept.length > 0) {
    lines.push(
      `Mantidos (nunca sobrescritos sem --force): ${result.kept.join(", ")}`,
    );
  }
  if (result.empty.length > 0) {
    lines.push(
      `Sem movimentação (sem snapshot): ${result.empty.join(", ")}`,
    );
  }

  if (lines.length === 0) {
    console.log("Nada a fazer: nenhum mês fechado para processar.");
    return;
  }

  for (const line of lines) console.log(line);
  const scope = options.month
    ? `mês ${options.month}`
    : `janela de ${options.months} mês(es)`;
  console.log(
    `${result.created.length + result.recalculated.length} snapshot(s) gravado(s) (${scope}).`,
  );
  console.log(
    "O histórico é imutável: rode com --force para recalcular um mês após corrigir dados.",
  );
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL não está definida.");
  }

  const options = parseArgs(process.argv.slice(2));
  const result = await ensureClosedMonthSnapshots(prisma, {
    force: options.force,
    month: options.month,
    months: options.months,
  });
  report(options, result);
}

const prisma = new PrismaClient();

main()
  .catch((error) => {
    const reason = error instanceof Error ? error.message : String(error);
    console.error(`Falha ao gerar snapshots: ${reason}`);
    console.error("Verifique DATABASE_URL e rode as migrations.");
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
