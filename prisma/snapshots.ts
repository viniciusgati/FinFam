import { PrismaClient } from "@prisma/client";
import { buildSnapshot, monthRange } from "../src/lib/snapshots";

const prisma = new PrismaClient();

const MONTHS = Number(process.env.SNAPSHOT_MONTHS ?? "4");

async function main() {
  const now = new Date();
  const months = monthRange(now, Number.isFinite(MONTHS) ? MONTHS : 4);
  if (months.length === 0) {
    console.log("Nenhum mês fechado para processar.");
    return;
  }

  const [firstYear, firstMonth] = months[0].split("-").map(Number);
  const rangeStart = new Date(firstYear, firstMonth - 1, 1);
  const currentStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [incomes, fixedExpenses, variableExpenses, cardPurchases] =
    await Promise.all([
      prisma.income.findMany({ where: { active: true } }),
      prisma.fixedExpense.findMany({ where: { active: true } }),
      prisma.variableExpense.findMany({
        where: { date: { gte: rangeStart, lt: currentStart } },
      }),
      prisma.cardPurchase.findMany({
        where: { purchaseDate: { gte: rangeStart, lt: currentStart } },
      }),
    ]);

  for (const key of months) {
    const snapshot = buildSnapshot({
      monthKey: key,
      incomes,
      fixedExpenses,
      variableExpenses,
      cardPurchases,
    });

    await prisma.monthlySnapshot.upsert({
      where: { monthKey: key },
      update: {
        incomeCents: snapshot.incomeCents,
        fixedExpensesCents: snapshot.fixedExpensesCents,
        variableExpensesCents: snapshot.variableExpensesCents,
        cardExpensesCents: snapshot.cardExpensesCents,
        consumedCents: snapshot.consumedCents,
        consumedPercent: snapshot.consumedPercent,
      },
      create: snapshot,
    });

    console.log(
      `Snapshot derivado: ${key} (${snapshot.consumedPercent.toFixed(2)}%).`,
    );
  }

  console.log(`${months.length} mês(es) recalculado(s).`);
}

main()
  .catch(() => {
    console.error(
      "Banco indisponível: verifique DATABASE_URL e rode as migrations.",
    );
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
