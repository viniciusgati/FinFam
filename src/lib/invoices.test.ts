import { describe, expect, it } from "vitest";
import { cycleWindowForKey, remainingCycleDays } from "./cycle";
import {
  allocateInstallments,
  cycleInvoicePaymentLabel,
  installmentDueDate,
  invoiceDueLabel,
  invoiceDueLabelForWindow,
  invoiceLinesForMonth,
  invoiceLinesForSeries,
  purchaseInstallmentsInWindow,
  purchaseInvoice,
  resolveReferenceDate,
  shiftDateMonthsClamped,
  sumCardExpensesByPurchaseWindow,
  sumCardExpensesForMonth,
  sumCardExpensesForWindow,
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

describe("invoiceLinesForSeries", () => {
  // Fechamento 20 / vencimento 28: competência no mês do ciclo.
  const card = { closingDay: 20, dueDay: 28 };

  it("marca o dia da compra quando ela é do próprio mês", () => {
    const purchase = {
      purchaseDate: new Date(Date.UTC(2026, 9, 12, 12)), // 12/10
      amountCents: 30000,
      installmentsTotal: 1,
      card,
    };

    expect(invoiceLinesForSeries([purchase], "2026-10")).toEqual([
      { amountCents: 30000, dueDay: 28, purchaseDay: 12 },
    ]);
  });

  it("zera o dia da compra para parcelas de compras de meses anteriores", () => {
    const purchase = {
      purchaseDate: new Date(Date.UTC(2026, 7, 10, 12)), // agosto, 3x
      amountCents: 9000,
      installmentsTotal: 3,
      card,
    };

    // A parcela de outubro é obrigação no vencimento (compra de outro mês).
    expect(invoiceLinesForSeries([purchase], "2026-10")).toEqual([
      { amountCents: 3000, dueDay: 28, purchaseDay: null },
    ]);
  });

  it("ignora meses sem parcela", () => {
    expect(invoiceLinesForSeries([], "2026-10")).toEqual([]);
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
  const now = new Date(Date.UTC(2026, 9, 8, 15)); // 08/10/2026 12:00 BRT

  it("mês corrente ancora no agora, nunca no dia 1", () => {
    expect(resolveReferenceDate("2026-10", now)).toBe(now);
  });

  it("voltar ao mês corrente pelo seletor não dobra os dias do ciclo (regressão)", () => {
    // Sintoma reportado: com `?mes` do mês corrente ancorado no dia 1, o
    // contador "dias para o fim do ciclo" vinha dobrado quando o ciclo começa
    // no meio do mês (dia 15): 14 dias em vez de 7.
    const resolved = resolveReferenceDate("2026-10", now);

    expect(remainingCycleDays(resolved, 15)).toBe(
      remainingCycleDays(now, 15),
    );
    expect(remainingCycleDays(resolved, 15)).toBe(7);
  });

  it("mês fechado ancora no último dia do mês no fuso do Brasil", () => {
    const resolved = resolveReferenceDate("2026-09", now);

    expect(invoiceDueLabel(resolved)).toBe(
      "Fatura com vencimento em setembro/2026",
    );
    expect(zonedDateParts(resolved, "America/Sao_Paulo")).toEqual({
      year: 2026,
      month: 9,
      day: 30,
    });
  });

  it("mês futuro segue no primeiro dia, no fuso do Brasil", () => {
    const resolved = resolveReferenceDate("2026-11", now);

    expect(invoiceDueLabel(resolved)).toBe(
      "Fatura com vencimento em novembro/2026",
    );
    expect(zonedDateParts(resolved, "America/Sao_Paulo")).toEqual({
      year: 2026,
      month: 11,
      day: 1,
    });
  });

  it("usa o último dia correto em fevereiro e em ano bissexto", () => {
    const june = new Date("2026-06-10T15:00:00Z");
    expect(
      zonedDateParts(resolveReferenceDate("2026-02", june), "America/Sao_Paulo")
        .day,
    ).toBe(28);

    const leapYear = new Date("2028-06-10T15:00:00Z");
    expect(
      zonedDateParts(
        resolveReferenceDate("2028-02", leapYear),
        "America/Sao_Paulo",
      ).day,
    ).toBe(29);
  });

  it("cai no mês atual para valor ausente ou inválido", () => {
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

describe("faturas na janela do ciclo", () => {
  const card = { closingDay: 15, dueDay: 21 };
  const cycle = cycleWindowForKey("2026-10", 15); // 15/10–14/11
  const at = (iso: string) => new Date(iso);

  const compra01out = {
    amountCents: 10000,
    purchaseDate: at("2026-10-01T12:00:00.000Z"),
    installmentsTotal: 1,
    card,
  };
  const compra20set = {
    amountCents: 20000,
    purchaseDate: at("2026-09-20T12:00:00.000Z"),
    installmentsTotal: 1,
    card,
  };
  // Depois do fechamento (15): a parcela vence em 21/11 e fica fora da janela.
  const compra16out = {
    amountCents: 40000,
    purchaseDate: at("2026-10-16T12:00:00.000Z"),
    installmentsTotal: 1,
    card,
  };
  // Parcelada: só a 1ª parcela vence na janela.
  const parcelada = {
    amountCents: 50000,
    purchaseDate: at("2026-10-01T12:00:00.000Z"),
    installmentsTotal: 2,
    card,
  };

  it("installmentDueDate resolve o vencimento no mês da competência", () => {
    expect(installmentDueDate("2026-10", 21).toISOString()).toBe(
      "2026-10-21T03:00:00.000Z",
    );
    // Dia 31 em mês de 28 vence no último dia do mês.
    expect(installmentDueDate("2026-02", 31).toISOString()).toBe(
      "2026-02-28T03:00:00.000Z",
    );
  });

  it("soma só as parcelas que vencem na janela", () => {
    const purchases = [compra01out, compra20set, compra16out, parcelada];

    expect(
      sumCardExpensesForWindow(purchases, {
        start: cycle.start,
        end: cycle.nextStart,
      }),
    ).toBe(10000 + 20000 + 25000);
  });

  it("shiftDateMonthsClamped soma meses limitando o dia ao mês de destino", () => {
    expect(
      shiftDateMonthsClamped(at("2026-10-16T12:00:00.000Z"), 1).toISOString(),
    ).toBe("2026-11-16T03:00:00.000Z");
    // 31/01 + 1 mês = 28/02.
    expect(
      shiftDateMonthsClamped(at("2026-01-31T12:00:00.000Z"), 1).toISOString(),
    ).toBe("2026-02-28T03:00:00.000Z");
  });

  it("parcela k cai no ciclo da compra + k−1 meses (competência pela data)", () => {
    const window1 = { start: cycle.start, end: cycle.nextStart };
    const window2 = {
      start: at("2026-11-15T03:00:00.000Z"),
      end: at("2026-12-15T03:00:00.000Z"),
    };

    // Compra 01/10 (1x): cai no ciclo anterior (15/09–14/10), não no atual.
    expect(
      purchaseInstallmentsInWindow(compra01out, window1).length,
    ).toBe(0);
    expect(
      purchaseInstallmentsInWindow(compra01out, {
        start: at("2026-09-15T03:00:00.000Z"),
        end: at("2026-10-15T03:00:00.000Z"),
      }).length,
    ).toBe(1);

    // Parcelada em 3x: 1ª no ciclo da compra, as seguintes um ciclo depois.
    const parcelada3 = {
      amountCents: 30000,
      purchaseDate: at("2026-10-01T15:00:00.000Z"),
      installmentsTotal: 3,
      card,
    };
    expect(
      purchaseInstallmentsInWindow(parcelada3, {
        start: at("2026-09-15T03:00:00.000Z"),
        end: at("2026-10-15T03:00:00.000Z"),
      }).map((installment) => installment.amountCents),
    ).toEqual([10000]);
    expect(
      purchaseInstallmentsInWindow(parcelada3, window1).map(
        (installment) => installment.amountCents,
      ),
    ).toEqual([10000]);
    expect(
      purchaseInstallmentsInWindow(parcelada3, window2).map(
        (installment) => installment.amountCents,
      ),
    ).toEqual([10000]);
  });

  it("sumCardExpensesByPurchaseWindow soma compras do ciclo e ignora a fatura antiga", () => {
    const purchases = [compra01out, compra16out];

    // Ciclo 15/10–14/11: só a compra de 16/10 (a de 01/10 é do ciclo anterior,
    // mesmo que a fatura dela vença em 21/10).
    expect(
      sumCardExpensesByPurchaseWindow(purchases, {
        start: cycle.start,
        end: cycle.nextStart,
      }),
    ).toBe(40000);
  });

  it("invoiceDueLabelForWindow cita o intervalo do ciclo", () => {
    expect(invoiceDueLabelForWindow(cycle)).toBe(
      "Faturas com vencimento no ciclo (15/10 a 14/11/2026)",
    );
  });
});

describe("cycleInvoicePaymentLabel", () => {
  it("mostra a fatura a pagar no ciclo e omite quando zero", () => {
    expect(
      cycleInvoicePaymentLabel(607215)
        ?.replace(/\u00a0/g, " ")
        .replace(/\u00a0/g, " "),
    ).toBe("Faturas a pagar no ciclo: R$ 6.072,15");
    expect(cycleInvoicePaymentLabel(0)).toBeNull();
    expect(cycleInvoicePaymentLabel(-10)).toBeNull();
  });
});
