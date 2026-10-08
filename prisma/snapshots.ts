import { PrismaClient } from "@prisma/client";
import { categoryKey } from "../src/lib/categories";
import { buildSnapshot, monthRange } from "../src/lib/snapshots";

const prisma = new PrismaClient();

const MONTHS = Number(process.env.SNAPSHOT_MONTHS ?? "4");

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL não está definida.");
  }

  const now = new Date();
  const months = monthRange(now, Number.isFinite(MONTHS) ? MONTHS : 4);
  if (months.length === 0) {
    console.log("Nenhum mês fechado para processar.");
    return;
  }

  const [firstYear, firstMonth] = months[0].split("-").map(Number);
  const rangeStart = new Date(firstYear, firstMonth - 1, 1);
  const currentStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [incomes, variableIncomes, fixedExpenses, variableExpenses, cardPurchases] =
    await Promise.all([
      prisma.income.findMany({ where: { active: true } }),
      prisma.variableIncome.findMany({
        where: { date: { gte: rangeStart, lt: currentStart } },
      }),
      prisma.fixedExpense.findMany({ where: { active: true } }),
      prisma.variableExpense.findMany({
        where: { date: { gte: rangeStart, lt: currentStart } },
      }),
      prisma.cardPurchase.findMany({
        where: { purchaseDate: { lt: currentStart } },
        include: { card: true },
      }),
    ]);

  for (const key of months) {
    const snapshot = buildSnapshot({
      monthKey: key,
      incomes,
      variableIncomes,
      fixedExpenses,
      variableExpenses,
      cardPurchases,
    });

    const { categories, ...monthly } = snapshot;

    // Idempotente: o upsert sobrescreve o snapshot e as categorias são
    // recriadas do zero para o mês dentro da mesma transação.
    await prisma.$transaction(async (tx) => {
      await tx.monthlySnapshot.upsert({
        where: { monthKey: key },
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
        where: { monthKey: key },
      });

      if (categories.length > 0) {
        await tx.monthlyCategorySnapshot.createMany({
          data: categories.map((item) => ({
            monthKey: key,
            categoryKey: categoryKey(item.category),
            categoryLabel: item.category,
            amountCents: item.amountCents,
          })),
        });
      }
    });

    console.log(
      `Snapshot derivado: ${key} (${snapshot.consumedPercent.toFixed(2)}%, ${categories.length} categoria(s)).`,
    );
  }

  console.log(`${months.length} mês(es) recalculado(s).`);
}

main()
  .catch((error) => {
    const reason = error instanceof Error ? error.message : String(error);
    console.error(`Banco indisponível: ${reason}`);
    console.error("Verifique DATABASE_URL e rode as migrations.");
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
