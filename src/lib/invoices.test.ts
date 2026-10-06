import { describe, expect, it } from "vitest";
import {
  allocateInstallments,
  invoiceDueLabel,
  invoiceLinesForMonth,
  purchaseInvoice,
  resolveReferenceDate,
  sumCardExpensesForMonth,
} from "./invoices";
import { zonedDateParts } from "./time";

describe("purchaseInvoice", () => {
  it("coloca a compra antes do fechamento no próprio mês", () => {
    expect(purchaseInvoice(new Date(Date.UTC(2026, 2, 10, 12)), 20, 5)).toEqual({
      cycleMonthKey: "2026-03",
      dueMonthKey: "2026-04",
    });
  });

  it("trata o dia do fechamento como inclusivo", () => {
    expect(purchaseInvoice(new Date(Date.UTC(2026, 2, 20, 12)), 20, 5).cycleMonthKey).toBe(
      "2026-03",
    );
  });

  it("empurra a compra após o fechamento para o mês seguinte", () => {
    expect(purchaseInvoice(new Date(Date.UTC(2026, 2, 25, 12)), 20, 5).cycleMonthKey).toBe(
      "2026-04",
    );
  });

  it("mantém o ciclo quando dueDay > closingDay", () => {
    expect(purchaseInvoice(new Date(Date.UTC(2026, 2, 10, 12)), 20, 25)).toEqual({
      cycleMonthKey: "2026-03",
      dueMonthKey: "2026-03",
    });
  });

  it("avança a competência quando dueDay <= closingDay", () => {
    expect(purchaseInvoice(new Date(Date.UTC(2026, 2, 10, 12)), 20, 5).dueMonthKey).toBe(
      "2026-04",
    );
  });

  it("vira o ano no vencimento", () => {
    expect(purchaseInvoice(new Date(Date.UTC(2026, 11, 10, 12)), 20, 5).dueMonthKey).toBe(
      "2027-01",
    );
  });

  it("vira o ano no ciclo", () => {
    expect(purchaseInvoice(new Date(Date.UTC(2026, 11, 28, 12)), 20, 5).cycleMonthKey).toBe(
      "2027-01",
    );
  });
});

describe("allocateInstallments", () => {
  it("rateia 3x em 10000 cruzando o ano com soma exata", () => {
    const installments = allocateInstallments(
      {
        purchaseDate: new Date(Date.UTC(2026, 10, 15, 12)), // 15/11/2026
        amountCents: 10000,
        installmentsTotal: 3,
      },
      20,
      5,
    );

    expect(installments.map((item) => item.monthKey)).toEqual([
      "2026-12",
      "2027-01",
      "2027-02",
    ]);
    expect(installments.map((item) => item.installmentNumber)).toEqual([
      1, 2, 3,
    ]);
    expect(installments.map((item) => item.amountCents)).toEqual([
      3334, 3333, 3333,
    ]);
    expect(
      installments.reduce((sum, item) => sum + item.amountCents, 0),
    ).toBe(10000);
  });

  it("mantém a soma exata em qualquer rateio inexato", () => {
    const installments = allocateInstallments(
      {
        purchaseDate: new Date(Date.UTC(2026, 0, 5, 12)),
        amountCents: 10001,
        installmentsTotal: 7,
      },
      20,
      5,
    );

    expect(installments).toHaveLength(7);
    expect(installments.reduce((sum, item) => sum + item.amountCents, 0)).toBe(
      10001,
    );
  });
});

describe("sumCardExpensesForMonth", () => {
  const purchase = {
    purchaseDate: new Date(Date.UTC(2026, 10, 15, 12)),
    amountCents: 300000,
    installmentsTotal: 3,
    card: { closingDay: 20, dueDay: 5 },
  };

  it("soma exatamente uma parcela em cada mês da competência", () => {
    expect(sumCardExpensesForMonth([purchase], "2026-12")).toBe(100000);
    expect(sumCardExpensesForMonth([purchase], "2027-01")).toBe(100000);
    expect(sumCardExpensesForMonth([purchase], "2027-02")).toBe(100000);
  });

  it("retorna 0 em mês sem parcelas e não conta o valor integral", () => {
    expect(sumCardExpensesForMonth([purchase], "2026-11")).toBe(0);
    expect(sumCardExpensesForMonth([purchase], "2027-03")).toBe(0);
    expect(sumCardExpensesForMonth([], "2026-12")).toBe(0);
  });

  it("não duplica a parcela entre meses", () => {
    expect(sumCardExpensesForMonth([purchase], "2026-12")).not.toBe(300000);
  });
});

describe("cenário do seed de validação manual", () => {
  // Cenário travado na task #208 com fixtures inline (o teste não lê o seed):
  // renda 1.470.000, fixas 290.000, variáveis 53.000/mês e "Notebook" 3x em
  // 15/11/2026. O prisma/seed.ts atual grava outro cenário, ancorado no mês
  // corrente (ver README — dados de exemplo idempotentes).
  const incomeCents = 1470000;
  const fixedExpensesCents = 290000;
  const variableCents = 45000 + 8000;

  const purchases = [
    {
      purchaseDate: new Date(Date.UTC(2026, 10, 15, 12)), // 15/11/2026, cartão A
      amountCents: 300000,
      installmentsTotal: 3,
      card: { closingDay: 20, dueDay: 5 },
    },
    {
      purchaseDate: new Date(Date.UTC(2026, 8, 8, 12)), // 08/09/2026, à vista
      amountCents: 60000,
      installmentsTotal: 1,
      card: { closingDay: 20, dueDay: 5 },
    },
  ];

  it.each(["2026-12", "2027-01"])(
    "conta uma única parcela em %s e fecha em 30%",
    (monthKey) => {
      const cardExpensesCents = sumCardExpensesForMonth(purchases, monthKey);
      expect(cardExpensesCents).toBe(100000);

      const consumed =
        fixedExpensesCents + variableCents + cardExpensesCents;
      expect(consumed).toBe(443000);
      expect(Math.round((consumed / incomeCents) * 100)).toBe(30);
    },
  );

  it("não conta o valor integral: a contraprova seria 44%", () => {
    const integral = fixedExpensesCents + variableCents + 300000;
    expect(integral).toBe(643000);
    expect(Math.round((integral / incomeCents) * 100)).toBe(44);
    expect(sumCardExpensesForMonth(purchases, "2026-12")).not.toBe(300000);
  });
});

describe("invoiceLinesForMonth", () => {
  const purchase = {
    id: "p1",
    description: "Notebook",
    category: "Eletrônicos",
    purchaseDate: new Date(Date.UTC(2026, 10, 15, 12)), // 15/11/2026
    amountCents: 30000,
    installmentsTotal: 3,
    card: { id: "c1", name: "Nubank", closingDay: 20, dueDay: 5 },
  };

  it("retorna a parcela 2/3 em 2027-01 com os metadados da compra", () => {
    const invoice = invoiceLinesForMonth([purchase], "2027-01");

    expect(invoice.monthKey).toBe("2027-01");
    expect(invoice.totalCents).toBe(10000);
    expect(invoice.lines).toEqual([
      {
        purchaseId: "p1",
        description: "Notebook",
        category: "Eletrônicos",
        cardId: "c1",
        cardName: "Nubank",
        installmentNumber: 2,
        installmentsTotal: 3,
        amountCents: 10000,
      },
    ]);
  });

  it("retorna lista vazia e total 0 em mês sem parcelas", () => {
    const invoice = invoiceLinesForMonth([purchase], "2026-11");
    expect(invoice.lines).toEqual([]);
    expect(invoice.totalCents).toBe(0);
  });

  it("soma exatamente o valor total ao longo dos meses, com rateio e resto", () => {
    const withRemainder = {
      ...purchase,
      amountCents: 10000,
    };

    const total = ["2026-12", "2027-01", "2027-02"].reduce(
      (sum, monthKey) =>
        sum + invoiceLinesForMonth([withRemainder], monthKey).totalCents,
      0,
    );

    expect(total).toBe(10000);
    expect(
      invoiceLinesForMonth([withRemainder], "2026-12").lines[0].amountCents,
    ).toBe(3334);
    expect(
      invoiceLinesForMonth([withRemainder], "2027-01").lines[0].amountCents,
    ).toBe(3333);
  });
});

describe("resolveReferenceDate", () => {
  it("interpreta ?mes válido como o primeiro dia do mês no fuso do Brasil", () => {
    const resolved = resolveReferenceDate(
      "2026-12",
      new Date(Date.UTC(2026, 9, 6, 12)),
    );

    expect(invoiceDueLabel(resolved)).toBe(
      "Fatura com vencimento em dezembro/2026",
    );
    expect(zonedDateParts(resolved, "America/Sao_Paulo")).toEqual({
      year: 2026,
      month: 12,
      day: 1,
    });
  });

  it("respeita o fuso do Brasil mesmo sob TZ=UTC", () => {
    const resolved = resolveReferenceDate("2026-11");

    expect(invoiceDueLabel(resolved)).toBe(
      "Fatura com vencimento em novembro/2026",
    );
    expect(zonedDateParts(resolved, "America/Sao_Paulo")).toEqual({
      year: 2026,
      month: 11,
      day: 1,
    });
  });

  it("cai no mês atual para valor ausente ou inválido", () => {
    const now = new Date(Date.UTC(2026, 9, 6, 12));
    expect(resolveReferenceDate(undefined, now)).toBe(now);
    expect(resolveReferenceDate("2026-13", now)).toBe(now);
    expect(resolveReferenceDate("abc", now)).toBe(now);
  });
});

describe("invoiceDueLabel", () => {
  it("formata o mês por extenso", () => {
    expect(invoiceDueLabel(new Date(Date.UTC(2026, 11, 1, 12)))).toBe(
      "Fatura com vencimento em dezembro/2026",
    );
    expect(invoiceDueLabel(new Date(Date.UTC(2027, 0, 1, 12)))).toBe(
      "Fatura com vencimento em janeiro/2027",
    );
  });

  it("segue o calendário do Brasil: 23:30 de 31/10 ainda é outubro", () => {
    expect(invoiceDueLabel(new Date("2026-11-01T02:30:00Z"))).toBe(
      "Fatura com vencimento em outubro/2026",
    );
  });
});
