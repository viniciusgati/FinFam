/**
 * Captura de snapshots de meses fechados.
 *
 * Regras (decisão de produto):
 * - Um mês fechado é capturado **uma única vez**: existente nunca é sobrescrito
 *   automaticamente; correções passam pelo CLI `db:snapshots --force`.
 * - Meses sem movimentação não geram snapshot (ver `hasSnapshotData`).
 * - A janela automática é `SNAPSHOT_AUTO_MONTHS`; o CLI cobre backfill maior.
 *
 * O módulo é agnóstico de runtime: recebe um `PrismaClient` por parâmetro (o
 * client base do app, o do CLI ou o de testes de integração) e não importa
 * `./db` — evitando ciclo com a extensão que chama esta captura.
 */

import type { PrismaClient } from "@prisma/client";
import { categoryKey } from "./categories";
import {
  buildSnapshot,
  hasSnapshotData,
  missingMonthKeys,
  monthRange,
  SNAPSHOT_AUTO_MONTHS,
  type MonthlySnapshotData,
} from "./snapshots";
import { resolveTimeZone, zonedTimeToUtc } from "./time";

/** Modelos de domínio cuja mutação pode exigir fechar um mês. */
const CAPTURE_TRIGGER_MODELS = new Set([
  "Income",
  "FixedExpense",
  "VariableExpense",
  "VariableIncome",
  "CardPurchase",
  "CreditCard",
]);

/**
 * Decide se uma operação do Prisma deve disparar a captura: mutações
 * (`create`/`update`/`delete`/`upsert`) nos modelos de domínio. As tabelas de
 * snapshot ficam de fora para não haver recursão. Função pura, testável.
 */
export function isSnapshotTrigger(
  model: string | undefined,
  operation: string,
): boolean {
  if (!model || !CAPTURE_TRIGGER_MODELS.has(model)) return false;
  return operation === "upsert" || /^(create|update|delete)/.test(operation);
}

export interface EnsureSnapshotsOptions {
  /** "Agora" injetável (testes e CLI). */
  now?: Date;
  /** Quantos meses fechados considerar (default `SNAPSHOT_AUTO_MONTHS`). */
  months?: number;
  /** Recalcula snapshots existentes (correção explícita via CLI). */
  force?: boolean;
  /** Processa um único mês `YYYY-MM` (correção explícita via CLI). */
  month?: string;
}

export interface EnsureSnapshotsResult {
  /** Meses cujo snapshot foi criado nesta chamada. */
  created: string[];
  /** Meses recalculados (`force`). */
  recalculated: string[];
  /** Meses mantidos como estavam (já existiam, sem `force`). */
  kept: string[];
  /** Meses fechados sem movimentação — não geram snapshot. */
  empty: string[];
}

const MONTH_ARG_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

function assertValidMonth(month: string): void {
  if (!MONTH_ARG_REGEX.test(month)) {
    throw new Error(`Mês inválido: "${month}". Use o formato AAAA-MM.`);
  }
}

/** Cria o snapshot (e categorias) apenas se ainda não existir. */
async function insertSnapshotOnce(
  db: PrismaClient,
  snapshot: MonthlySnapshotData,
): Promise<boolean> {
  const { categories, ...monthly } = snapshot;

  return db.$transaction(async (tx) => {
    const inserted = await tx.monthlySnapshot.createMany({
      data: [monthly],
      skipDuplicates: true,
    });
    if (inserted.count === 0) return false;

    if (categories.length > 0) {
      await tx.monthlyCategorySnapshot.createMany({
        data: categories.map((item) => ({
          monthKey: monthly.monthKey,
          categoryKey: categoryKey(item.category),
          categoryLabel: item.category,
          amountCents: item.amountCents,
        })),
        skipDuplicates: true,
      });
    }
    return true;
  });
}

/** Recalcula o snapshot (correção explícita): sobrescreve e recria categorias. */
async function replaceSnapshot(
  db: PrismaClient,
  snapshot: MonthlySnapshotData,
): Promise<void> {
  const { categories, ...monthly } = snapshot;

  await db.$transaction(async (tx) => {
    await tx.monthlySnapshot.upsert({
      where: { monthKey: monthly.monthKey },
      update: {
        incomeCents: monthly.incomeCents,
        fixedExpensesCents: monthly.fixedExpensesCents,
        variableExpensesCents: monthly.variableExpensesCents,
        cardExpensesCents: monthly.cardExpensesCents,
        consumedCents: monthly.consumedCents,
        consumedPercent: monthly.consumedPercent,
        consumptionAvailableCents: monthly.consumptionAvailableCents,
        dailyAverageCents: monthly.dailyAverageCents,
        daysInMonth: monthly.daysInMonth,
      },
      create: monthly,
    });

    await tx.monthlyCategorySnapshot.deleteMany({
      where: { monthKey: monthly.monthKey },
    });

    if (categories.length > 0) {
      await tx.monthlyCategorySnapshot.createMany({
        data: categories.map((item) => ({
          monthKey: monthly.monthKey,
          categoryKey: categoryKey(item.category),
          categoryLabel: item.category,
          amountCents: item.amountCents,
        })),
      });
    }
  });
}

/**
 * Garante os snapshots dos meses fechados alvo: cria os ausentes e, com
 * `force`, recalcula os existentes. Idempotente e seguro para rodar em
 * paralelo (`skipDuplicates` + transação por mês).
 */
export async function ensureClosedMonthSnapshots(
  db: PrismaClient,
  options: EnsureSnapshotsOptions = {},
): Promise<EnsureSnapshotsResult> {
  const now = options.now ?? new Date();
  const keys = options.month
    ? [checkedMonth(options.month)]
    : monthRange(now, options.months ?? SNAPSHOT_AUTO_MONTHS);

  const result: EnsureSnapshotsResult = {
    created: [],
    recalculated: [],
    kept: [],
    empty: [],
  };
  if (keys.length === 0) return result;

  const existingRows = await db.monthlySnapshot.findMany({
    where: { monthKey: { in: keys } },
    select: { monthKey: true },
  });
  const existing = new Set(existingRows.map((row) => row.monthKey));

  const targets = options.force ? keys : missingMonthKeys(existing, keys);
  const targetSet = new Set(targets);
  result.kept = keys.filter((key) => !targetSet.has(key));
  if (targets.length === 0) return result;

  // Carrega as transações da janela uma única vez e deriva cada mês.
  const timeZone = resolveTimeZone();
  const [firstYear, firstMonth] = targets[0].split("-").map(Number);
  const [lastYear, lastMonth] = targets[targets.length - 1].split("-").map(Number);
  const rangeStart = zonedTimeToUtc(firstYear, firstMonth, 1, timeZone);
  const rangeEnd = zonedTimeToUtc(lastYear, lastMonth + 1, 1, timeZone);

  const [incomes, fixedExpenses, variableIncomes, variableExpenses, cardPurchases] =
    await Promise.all([
      db.income.findMany({ where: { active: true } }),
      db.fixedExpense.findMany({ where: { active: true } }),
      db.variableIncome.findMany({
        where: { date: { gte: rangeStart, lt: rangeEnd } },
      }),
      db.variableExpense.findMany({
        where: { date: { gte: rangeStart, lt: rangeEnd } },
      }),
      db.cardPurchase.findMany({
        where: { purchaseDate: { lt: rangeEnd } },
        include: { card: true },
      }),
    ]);

  for (const key of targets) {
    const snapshot = buildSnapshot({
      monthKey: key,
      incomes,
      fixedExpenses,
      variableIncomes,
      variableExpenses,
      cardPurchases,
    });

    if (!hasSnapshotData(snapshot)) {
      result.empty.push(key);
      continue;
    }

    if (options.force) {
      await replaceSnapshot(db, snapshot);
      (existing.has(key) ? result.recalculated : result.created).push(key);
      continue;
    }

    const created = await insertSnapshotOnce(db, snapshot);
    (created ? result.created : result.kept).push(key);
  }

  return result;
}

function checkedMonth(month: string): string {
  assertValidMonth(month);
  return month;
}
