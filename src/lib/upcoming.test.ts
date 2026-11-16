import { describe, expect, it } from "vitest";
import { cycleWindowForKey } from "./cycle";
import type { CardPurchaseRecord } from "./invoices";
import {
  billLineLabel,
  buildEndingSoonWarnings,
  buildUpcomingCommitments,
  endingSoonLabel,
  UPCOMING_WARNING_MONTHS,
  type UpcomingCard,
  type UpcomingFixedExpense,
} from "./upcoming";

const TIME_ZONE = "America/Sao_Paulo";

function normalize(value: string): string {
  return value.replace(/\u00a0/g, " ");
}

const expense = (
  overrides: Partial<UpcomingFixedExpense> & { id?: string } = {},
): UpcomingFixedExpense & { id?: string } => ({
  name: "Aluguel",
  amountCents: 150000,
  dueDay: 10,
  active: true,
  startMonth: null,
  endMonth: null,
  ...overrides,
});

const card: UpcomingCard = {
  id: "c1",
  name: "Nubank",
  closingDay: 20,
  dueDay: 10,
};

const purchase = (
  overrides: Partial<CardPurchaseRecord> = {},
): CardPurchaseRecord => ({
  id: "p1",
  description: "Compra",
  purchaseDate: new Date(Date.UTC(2026, 10, 5, 12)), // 05/11/2026
  amountCents: 10001,
  installmentsTotal: 2,
  card,
  ...overrides,
});

describe("buildUpcomingCommitments", () => {
  it("limita o vencimento ao último dia do mês (31 em novembro vira 30/11)", () => {
    const cycle = cycleWindowForKey("2026-11", 1, TIME_ZONE);

    const { bills } = buildUpcomingCommitments({
      cycle,
      fixedExpenses: [expense({ dueDay: 31 })],
      cards: [],
      purchases: [],
      referenceMonthKey: "2026-11",
      timeZone: TIME_ZONE,
    });

    expect(bills).toEqual([
      { name: "Aluguel", dueDate: "2026-11-30", amountCents: 150000 },
    ]);
  });

  it("exclui a conta quando o startMonth é posterior ao mês do vencimento", () => {
    const cycle = cycleWindowForKey("2026-11", 1, TIME_ZONE);

    const { bills } = buildUpcomingCommitments({
      cycle,
      fixedExpenses: [expense({ dueDay: 5, startMonth: "2026-12" })],
      cards: [],
      purchases: [],
      referenceMonthKey: "2026-11",
      timeZone: TIME_ZONE,
    });

    expect(bills).toEqual([]);
  });

  it("inclui a fatura com vencimento na janela pelo valor da competência e ordena por data", () => {
    const cycle = cycleWindowForKey("2026-11", 15, TIME_ZONE); // 15/11 a 14/12

    const { bills } = buildUpcomingCommitments({
      cycle,
      fixedExpenses: [expense({ name: "Aluguel", dueDay: 20, amountCents: 150000 })],
      cards: [card],
      purchases: [purchase({ amountCents: 10001, installmentsTotal: 2 })],
      referenceMonthKey: "2026-11",
      timeZone: TIME_ZONE,
    });

    // 1ª parcela (5001) vence em 10/12; a 2ª (5000) em 10/01, fora da janela.
    expect(bills).toEqual([
      { name: "Aluguel", dueDate: "2026-11-20", amountCents: 150000 },
      { name: "Fatura Nubank", dueDate: "2026-12-10", amountCents: 5001 },
    ]);
  });

  it("ignora fatura fora da janela do ciclo", () => {
    const cycle = cycleWindowForKey("2026-11", 1, TIME_ZONE); // 01/11 a 30/11

    const { bills } = buildUpcomingCommitments({
      cycle,
      fixedExpenses: [],
      cards: [card],
      purchases: [purchase()],
      referenceMonthKey: "2026-11",
      timeZone: TIME_ZONE,
    });

    // Competência 12/2026 vence em 10/12, depois do fim do ciclo.
    expect(bills).toEqual([]);
  });

  it("avisa somente endMonth a 1 ou 2 meses do mês-base", () => {
    expect(UPCOMING_WARNING_MONTHS).toBe(2);

    const cycle = cycleWindowForKey("2026-11", 1, TIME_ZONE);

    const { endingSoon } = buildUpcomingCommitments({
      cycle,
      fixedExpenses: [
        expense({ name: "Internet", endMonth: "2026-12" }),
        expense({ name: "Academia", endMonth: "2026-12" }),
        expense({ name: "Celular", endMonth: "2027-01" }),
        expense({ name: "No mês-base", endMonth: "2026-11" }),
        expense({ name: "Terceiro mês", endMonth: "2027-02" }),
        expense({ name: "Sem fim", endMonth: null }),
        expense({ name: "Inativa", endMonth: "2026-12", active: false }),
      ],
      cards: [],
      purchases: [],
      referenceMonthKey: "2026-11",
      timeZone: TIME_ZONE,
    });

    expect(endingSoon).toEqual([
      { name: "Academia", endMonth: "2026-12" },
      { name: "Internet", endMonth: "2026-12" },
      { name: "Celular", endMonth: "2027-01" },
    ]);
  });
});

describe("buildEndingSoonWarnings", () => {
  it("preserva o id do item e ordena por endMonth e nome", () => {
    const warnings = buildEndingSoonWarnings(
      [
        expense({ id: "i1", name: "Internet", endMonth: "2026-12" }),
        expense({ id: "i2", name: "Academia", endMonth: "2026-12" }),
        expense({ id: "i3", name: "Celular", endMonth: "2027-01" }),
        expense({ id: "i4", name: "Sem fim", endMonth: null }),
        expense({ id: "i5", name: "Fora da janela", endMonth: "2027-02" }),
      ],
      "2026-11",
    );

    expect(warnings).toEqual([
      { id: "i2", name: "Academia", endMonth: "2026-12" },
      { id: "i1", name: "Internet", endMonth: "2026-12" },
      { id: "i3", name: "Celular", endMonth: "2027-01" },
    ]);
  });

  it("não sinaliza item inativo", () => {
    expect(
      buildEndingSoonWarnings(
        [expense({ name: "Inativa", endMonth: "2026-12", active: false })],
        "2026-11",
      ),
    ).toEqual([]);
  });
});

describe("billLineLabel", () => {
  it("monta nome, dd/mm e valor", () => {
    expect(
      normalize(
        billLineLabel({
          name: "Aluguel",
          dueDate: "2026-11-30",
          amountCents: 150000,
        }),
      ),
    ).toBe("Aluguel — 30/11 — R$ 1.500,00");
  });
});

describe("endingSoonLabel", () => {
  it("monta o mês de término por extenso", () => {
    expect(endingSoonLabel({ name: "Celular", endMonth: "2027-01" })).toBe(
      "Termina em janeiro de 2027",
    );
  });
});
