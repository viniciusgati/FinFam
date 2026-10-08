import { PrismaClient, PaymentMethod } from "@prisma/client";
import {
  consumptionAvailableCents,
  consumptionDailyAverageCents,
  monthKey,
  previousMonthKeys,
} from "../src/lib/finance";
import { daysInMonthKey } from "../src/lib/snapshots";

const prisma = new PrismaClient();

/**
 * Seed idempotente: cada linha é localizada pela sua chave natural
 * (findFirst) e atualizada ou criada — nunca há deleteMany sem `--reset`,
 * então reexecutar no mesmo mês não duplica nem apaga dados reais.
 */

const INCOMES = [
  { name: "Salário", amountCents: 850000, receiveDay: 5 },
  { name: "Salário cônjuge", amountCents: 620000, receiveDay: 5 },
];

const FIXED_EXPENSES = [
  { name: "Aluguel", amountCents: 250000, dueDay: 10, category: "Moradia" },
  { name: "Energia", amountCents: 28000, dueDay: 15, category: "Casa" },
  { name: "Internet", amountCents: 12000, dueDay: 20, category: "Casa" },
];

const CREDIT_CARD = { name: "Cartão principal", closingDay: 20, dueDay: 5 };

const VARIABLE_EXPENSES = [
  {
    description: "Mercado",
    amountCents: 45000,
    day: 3,
    category: "Alimentação",
    paymentMethod: PaymentMethod.PIX,
    paid: true,
  },
  {
    description: "Farmácia",
    amountCents: 8000,
    day: 6,
    category: "Saúde",
    paymentMethod: PaymentMethod.DEBIT,
    paid: true,
  },
];

const CARD_PURCHASE = {
  description: "Supermercado",
  amountCents: 60000,
  day: 8,
  category: "Alimentação",
};

// Mesmos números do mês corrente aplicados aos 4 meses fechados, variando
// só os gastos avulsos — todos os históricos ficam estritamente acima do
// percentual do mês corrente, para o dashboard mostrar "Estão melhores
// que os últimos 4 meses.".
const SNAPSHOT_INCOME_CENTS = 1470000;
const SNAPSHOT_FIXED_EXPENSES_CENTS = 290000;
const SNAPSHOT_CARD_EXPENSES_CENTS = 60000;
const CURRENT_VARIABLE_EXPENSES_CENTS = 53000;
const HISTORICAL_VARIABLE_EXPENSES_CENTS = [150000, 170000, 140000, 190000];

/**
 * Cria ou atualiza uma linha pela chave natural. O schema não marca essas
 * colunas como `@unique`, então não usamos `upsert` do Prisma.
 */
async function upsertRow<T extends { id: string }>(
  find: () => Promise<T | null>,
  create: () => PromiseLike<T>,
  update: (row: T) => PromiseLike<T>,
): Promise<T> {
  const existing = await find();
  return existing ? update(existing) : create();
}

async function seed() {
  for (const income of INCOMES) {
    await upsertRow(
      () => prisma.income.findFirst({ where: { name: income.name } }),
      () => prisma.income.create({ data: income }),
      (row) => prisma.income.update({ where: { id: row.id }, data: income }),
    );
  }

  for (const fixedExpense of FIXED_EXPENSES) {
    await upsertRow(
      () =>
        prisma.fixedExpense.findFirst({
          where: { name: fixedExpense.name },
        }),
      () => prisma.fixedExpense.create({ data: fixedExpense }),
      (row) =>
        prisma.fixedExpense.update({
          where: { id: row.id },
          data: fixedExpense,
        }),
    );
  }

  const card = await upsertRow(
    () => prisma.creditCard.findFirst({ where: { name: CREDIT_CARD.name } }),
    () => prisma.creditCard.create({ data: CREDIT_CARD }),
    (row) =>
      prisma.creditCard.update({
        where: { id: row.id },
        data: { closingDay: CREDIT_CARD.closingDay, dueDay: CREDIT_CARD.dueDay },
      }),
  );

  const now = new Date();
  const dayOfMonth = (day: number) =>
    new Date(now.getFullYear(), now.getMonth(), day);

  for (const { day, ...data } of VARIABLE_EXPENSES) {
    const date = dayOfMonth(day);
    await upsertRow(
      () =>
        prisma.variableExpense.findFirst({
          where: { description: data.description, date },
        }),
      () => prisma.variableExpense.create({ data: { ...data, date } }),
      (row) => prisma.variableExpense.update({ where: { id: row.id }, data }),
    );
  }

  const purchaseDate = dayOfMonth(CARD_PURCHASE.day);
  await upsertRow(
    () =>
      prisma.cardPurchase.findFirst({
        where: {
          cardId: card.id,
          description: CARD_PURCHASE.description,
          purchaseDate,
          installmentNumber: 1,
        },
      }),
    () =>
      prisma.cardPurchase.create({
        data: {
          cardId: card.id,
          description: CARD_PURCHASE.description,
          amountCents: CARD_PURCHASE.amountCents,
          purchaseDate,
          category: CARD_PURCHASE.category,
        },
      }),
    (row) =>
      prisma.cardPurchase.update({
        where: { id: row.id },
        data: {
          amountCents: CARD_PURCHASE.amountCents,
          category: CARD_PURCHASE.category,
        },
      }),
  );

  await seedSnapshots(now);
}

/** 5 snapshots contíguos: os 4 meses fechados + o mês corrente. */
async function seedSnapshots(now: Date) {
  const historical = previousMonthKeys(now).map((key, index) => ({
    monthKey: key,
    variableExpensesCents: HISTORICAL_VARIABLE_EXPENSES_CENTS[index],
  }));
  const snapshots = [
    ...historical,
    {
      monthKey: monthKey(now),
      variableExpensesCents: CURRENT_VARIABLE_EXPENSES_CENTS,
    },
  ];

  for (const snapshot of snapshots) {
    const consumedCents =
      SNAPSHOT_FIXED_EXPENSES_CENTS +
      snapshot.variableExpensesCents +
      SNAPSHOT_CARD_EXPENSES_CENTS;
    const days = daysInMonthKey(snapshot.monthKey);
    const available = consumptionAvailableCents({
      monthlyIncomeCents: SNAPSHOT_INCOME_CENTS,
      fixedExpensesCents: SNAPSHOT_FIXED_EXPENSES_CENTS,
    });

    // Série diária sintética coerente com os agregados: o consumo variável cai
    // no dia 3 e as obrigações (fixas + fatura) no dia 10, como no cenário real
    // do seed. Assim os meses fechados de demonstração são "completos" e o
    // dashboard não precisa cair no cálculo ao vivo.
    const variableDailyCents = Array.from({ length: days }, (_, index) =>
      index === 2 ? snapshot.variableExpensesCents : 0,
    );
    const obligationDailyCents = Array.from({ length: days }, (_, index) =>
      index === 9
        ? SNAPSHOT_FIXED_EXPENSES_CENTS + SNAPSHOT_CARD_EXPENSES_CENTS
        : 0,
    );

    const data = {
      incomeCents: SNAPSHOT_INCOME_CENTS,
      fixedIncomeCents: SNAPSHOT_INCOME_CENTS,
      variableIncomeCents: 0,
      fixedExpensesCents: SNAPSHOT_FIXED_EXPENSES_CENTS,
      variableExpensesCents: snapshot.variableExpensesCents,
      cardExpensesCents: SNAPSHOT_CARD_EXPENSES_CENTS,
      consumedCents,
      consumedPercent: (consumedCents / SNAPSHOT_INCOME_CENTS) * 100,
      consumptionAvailableCents: available,
      dailyAverageCents: consumptionDailyAverageCents(available, days),
      daysInMonth: days,
      variableDailyCents,
      obligationDailyCents,
    };

    await upsertRow(
      () =>
        prisma.monthlySnapshot.findFirst({
          where: { monthKey: snapshot.monthKey },
        }),
      () =>
        prisma.monthlySnapshot.create({
          data: { monthKey: snapshot.monthKey, ...data },
        }),
      (row) => prisma.monthlySnapshot.update({ where: { id: row.id }, data }),
    );
  }
}

/** Único caminho destrutivo — só roda com a flag `--reset`. */
async function resetDatabase() {
  await prisma.cardPurchase.deleteMany();
  await prisma.variableExpense.deleteMany();
  await prisma.variableIncome.deleteMany();
  await prisma.creditCard.deleteMany();
  await prisma.fixedExpense.deleteMany();
  await prisma.income.deleteMany();
  await prisma.monthlySnapshot.deleteMany();
}

async function main() {
  const reset = process.argv.includes("--reset");
  if (reset) {
    await resetDatabase();
  }

  await seed();

  console.log(
    reset
      ? "Banco reiniciado com dados de exemplo. Seed concluído."
      : "Seed concluído.",
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
