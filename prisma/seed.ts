import { PrismaClient, PaymentMethod } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.income.deleteMany();
  await prisma.fixedExpense.deleteMany();
  await prisma.variableExpense.deleteMany();
  await prisma.cardPurchase.deleteMany();
  await prisma.creditCard.deleteMany();
  await prisma.monthlySnapshot.deleteMany();

  await prisma.income.createMany({
    data: [
      { name: "Salário", amountCents: 850000, receiveDay: 5 },
      { name: "Salário cônjuge", amountCents: 620000, receiveDay: 5 },
    ],
  });

  await prisma.fixedExpense.createMany({
    data: [
      { name: "Aluguel", amountCents: 250000, dueDay: 10, category: "Moradia" },
      { name: "Energia", amountCents: 28000, dueDay: 15, category: "Casa" },
      { name: "Internet", amountCents: 12000, dueDay: 20, category: "Casa" },
    ],
  });

  const card = await prisma.creditCard.create({
    data: { name: "Cartão principal", closingDay: 20, dueDay: 5 },
  });

  const now = new Date();
  await prisma.variableExpense.createMany({
    data: [
      {
        description: "Mercado",
        amountCents: 45000,
        date: new Date(now.getFullYear(), now.getMonth(), 3),
        category: "Alimentação",
        paymentMethod: PaymentMethod.PIX,
        paid: true,
      },
      {
        description: "Farmácia",
        amountCents: 8000,
        date: new Date(now.getFullYear(), now.getMonth(), 6),
        category: "Saúde",
        paymentMethod: PaymentMethod.DEBIT,
        paid: true,
      },
    ],
  });

  await prisma.cardPurchase.create({
    data: {
      cardId: card.id,
      description: "Supermercado",
      amountCents: 60000,
      purchaseDate: new Date(now.getFullYear(), now.getMonth(), 8),
      category: "Alimentação",
    },
  });

  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  await prisma.monthlySnapshot.create({
    data: {
      monthKey,
      incomeCents: 1470000,
      fixedExpensesCents: 290000,
      variableExpensesCents: 53000,
      cardExpensesCents: 60000,
      consumedCents: 403000,
      consumedPercent: (403000 / 1470000) * 100,
    },
  });

  console.log("Seed concluído.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
