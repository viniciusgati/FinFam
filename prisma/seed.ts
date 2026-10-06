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

  // Datas fixas (sem `now`) para que a validação manual seja determinística.
  await prisma.variableExpense.createMany({
    data: [
      {
        description: "Mercado",
        amountCents: 45000,
        date: new Date(2026, 11, 3), // 03/12/2026
        category: "Alimentação",
        paymentMethod: PaymentMethod.PIX,
        paid: true,
      },
      {
        description: "Farmácia",
        amountCents: 8000,
        date: new Date(2026, 11, 6), // 06/12/2026
        category: "Saúde",
        paymentMethod: PaymentMethod.DEBIT,
        paid: true,
      },
      {
        description: "Mercado",
        amountCents: 45000,
        date: new Date(2027, 0, 3), // 03/01/2027
        category: "Alimentação",
        paymentMethod: PaymentMethod.PIX,
        paid: true,
      },
      {
        description: "Farmácia",
        amountCents: 8000,
        date: new Date(2027, 0, 6), // 06/01/2027
        category: "Saúde",
        paymentMethod: PaymentMethod.DEBIT,
        paid: true,
      },
    ],
  });

  const cardA = await prisma.creditCard.create({
    data: {
      name: "Cartão A",
      closingDay: 20,
      dueDay: 5, // dueDay <= closingDay: competência avança 1 mês
    },
  });

  await prisma.creditCard.create({
    data: {
      name: "Cartão B",
      closingDay: 20,
      dueDay: 25, // dueDay > closingDay: competência no mês do ciclo
    },
  });

  // Compra parcelada 3x em 15/11/2026 → parcelas em 12/2026, 01/2027 e 02/2027.
  await prisma.cardPurchase.create({
    data: {
      cardId: cardA.id,
      description: "Notebook",
      amountCents: 300000,
      purchaseDate: new Date(2026, 10, 15),
      category: "Eletrônicos",
      installmentNumber: 1,
      installmentsTotal: 3,
    },
  });

  // Compra à vista fora dos meses conferidos (não altera 12/2026 nem 01/2027).
  await prisma.cardPurchase.create({
    data: {
      cardId: cardA.id,
      description: "Supermercado",
      amountCents: 60000,
      purchaseDate: new Date(2026, 8, 8), // 08/09/2026 → fatura 10/2026
      category: "Alimentação",
    },
  });

  await prisma.monthlySnapshot.createMany({
    data: [
      {
        monthKey: "2026-10",
        incomeCents: 1470000,
        fixedExpensesCents: 290000,
        variableExpensesCents: 0,
        cardExpensesCents: 60000,
        consumedCents: 350000,
        consumedPercent: (350000 / 1470000) * 100,
      },
      {
        monthKey: "2026-11",
        incomeCents: 1470000,
        fixedExpensesCents: 290000,
        variableExpensesCents: 0,
        cardExpensesCents: 0,
        consumedCents: 290000,
        consumedPercent: (290000 / 1470000) * 100,
      },
    ],
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
