import { describe, expect, it } from "vitest";
import {
  detectInvoiceCompetence,
  planInvoiceImport,
  type InvoiceImportCard,
  type InvoiceImportExistingPurchase,
} from "./invoice-import";
import { parseNubankInvoiceCsv, type InvoiceCsvRow } from "./invoice-csv";

const card: InvoiceImportCard = { closingDay: 13, dueDay: 20 };

function row(
  line: number,
  date: string,
  amountCents: number,
  title = "Loja X",
): InvoiceCsvRow {
  return { line, date, title, amountCents };
}

function purchase(
  overrides: Partial<InvoiceImportExistingPurchase> & { id: string },
): InvoiceImportExistingPurchase {
  return {
    description: "Compra",
    purchaseDate: new Date(Date.UTC(2026, 8, 5, 12)),
    amountCents: 10000,
    installmentsTotal: 1,
    ...overrides,
  };
}

/**
 * CSV de exemplo da história: linhas de 13/08/2026 a 10/09/2026 para cartão
 * de fechamento dia 13 e vencimento dia 20 — a linha de 13/08 é a minoria
 * (competência 2026-08) e todas as demais caem em 2026-09.
 */
const EXAMPLE_CSV = [
  "date,title,amount",
  "2026-08-13,Padaria Central,12,34",
  "2026-08-14,Netflix.Com,45,90",
  "2026-08-16,Posto Avenida,150,00",
  "2026-08-21,Supermercado Bom Preço,238,76",
  "2026-08-29,UBER TRIP,23,45",
  "2026-09-02,Farmácia Vida,87,90",
  "2026-09-04,Netflix.Com,45,90",
  "2026-09-07,Padaria Central,18,50",
  "2026-09-10,Loja de Roupas,312,10",
  "2026-09-05,Pagamento recebido,- 500,00",
].join("\n");

function parseExample(): {
  positives: InvoiceCsvRow[];
  ignored: number;
} {
  const parsed = parseNubankInvoiceCsv(EXAMPLE_CSV);
  expect(parsed.headerError).toBeUndefined();
  return {
    positives: parsed.positives,
    ignored: parsed.negatives.length + parsed.invalid.length,
  };
}

describe("detectInvoiceCompetence", () => {
  it("maioria das linhas define a competência (CSV de exemplo → 2026-09)", () => {
    const { positives } = parseExample();

    expect(detectInvoiceCompetence(positives, card)).toBe("2026-09");
  });

  it("empate de linhas vence quem tem maior soma absoluta de valores", () => {
    const lines = [
      row(2, "2026-08-10", 500), // competência 2026-08 (10 ≤ 13)
      row(3, "2026-09-20", 90000), // competência 2026-10 (20 > 13)
    ];

    expect(detectInvoiceCompetence(lines, card)).toBe("2026-10");
  });

  it("empate de linhas e de soma desempata no mês mais recente", () => {
    const lines = [
      row(2, "2026-08-10", 5000), // 2026-08
      row(3, "2026-09-20", 5000), // 2026-10
    ];

    expect(detectInvoiceCompetence(lines, card)).toBe("2026-10");
  });

  it("sem linhas não há competência", () => {
    expect(detectInvoiceCompetence([], card)).toBeNull();
  });
});

describe("planInvoiceImport", () => {
  it("CSV de exemplo: ajusta a minoria de 13/08 para 14/08 preservando o valor", () => {
    const { positives, ignored } = parseExample();

    const plan = planInvoiceImport({
      lines: positives,
      card,
      existing: [],
      ignored,
    });

    expect(plan.monthKey).toBe("2026-09");
    expect(plan.ignored).toBe(1);
    expect(plan.adjustedRows).toEqual([
      { line: 2, date: "2026-08-13", adjustedDate: "2026-08-14" },
    ]);
    expect(plan.toInsert).toHaveLength(9);
    expect(plan.toInsert[0]).toEqual({
      line: 2,
      date: "2026-08-14",
      title: "Padaria Central",
      amountCents: 1234,
    });
    // As demais linhas já caem na janela e seguem na ordem do arquivo.
    expect(plan.toInsert.map((insert) => insert.line)).toEqual([
      2, 3, 4, 5, 6, 7, 8, 9, 10,
    ]);
    expect(plan.toSkipMatched).toEqual([]);
  });

  it("linha depois da janela recebe o ajuste mínimo (20/09 → 13/09)", () => {
    const lines = [
      row(2, "2026-08-14", 1000),
      row(3, "2026-09-10", 2000),
      row(4, "2026-09-20", 3000), // competência 2026-10 (20 > 13)
    ];

    const plan = planInvoiceImport({ lines, card, existing: [], ignored: 0 });

    expect(plan.monthKey).toBe("2026-09");
    expect(plan.adjustedRows).toEqual([
      { line: 4, date: "2026-09-20", adjustedDate: "2026-09-13" },
    ]);
    expect(plan.toInsert[2]).toEqual({
      line: 4,
      date: "2026-09-13",
      title: "Loja X",
      amountCents: 3000,
    });
  });

  it("marca para exclusão só as à vistas da competência alvo (inclui ajuste)", () => {
    const lines = [row(2, "2026-08-14", 1000)];
    const existing = [
      // À vista na competência alvo: "Ajuste de fatura" é apagado.
      purchase({
        id: "ajuste",
        description: "Ajuste de fatura",
        purchaseDate: new Date(Date.UTC(2026, 8, 5, 12)), // 05/09 → 2026-09
        amountCents: 99900,
      }),
      // À vista de outra competência: permanece.
      purchase({
        id: "outra",
        purchaseDate: new Date(Date.UTC(2026, 6, 10, 12)), // 10/07 → 2026-07
      }),
      // Parcelada na competência alvo: nunca é apagada.
      purchase({
        id: "parcelada",
        description: "Loja Nova",
        purchaseDate: new Date(Date.UTC(2026, 8, 1, 12)), // 01/09 → 2026-09
        amountCents: 80000,
        installmentsTotal: 8,
      }),
    ];

    const plan = planInvoiceImport({ lines, card, existing, ignored: 0 });

    expect(plan.monthKey).toBe("2026-09");
    expect(plan.toDeleteIds).toEqual(["ajuste"]);
  });

  it("casa `… - Parcela 2/8` com a parcelada existente de valor igual", () => {
    const lines = [
      row(2, "2026-09-05", 10000, "Loja Nova - Parcela 2/8"),
    ];
    const existing = [
      purchase({
        id: "parcelada",
        description: "Loja Nova",
        purchaseDate: new Date(Date.UTC(2026, 8, 1, 12)),
        amountCents: 80000, // 8 × 10.000
        installmentsTotal: 8,
      }),
    ];

    const plan = planInvoiceImport({ lines, card, existing, ignored: 0 });

    expect(plan.toSkipMatched).toEqual([lines[0]]);
    expect(plan.toInsert).toEqual([]);
    expect(plan.toDeleteIds).toEqual([]);
  });

  it("`… - Parcela 2/8` com valor diferente é inserida como à vista", () => {
    const lines = [
      row(2, "2026-09-05", 9999, "Loja Nova - Parcela 2/8"),
    ];
    const existing = [
      purchase({
        id: "parcelada",
        description: "Loja Nova",
        purchaseDate: new Date(Date.UTC(2026, 8, 1, 12)),
        amountCents: 80000, // 2ª parcela = 10.000 ≠ 9.999
        installmentsTotal: 8,
      }),
    ];

    const plan = planInvoiceImport({ lines, card, existing, ignored: 0 });

    expect(plan.toSkipMatched).toEqual([]);
    expect(plan.toInsert).toEqual([
      { line: 2, date: "2026-09-05", title: "Loja Nova - Parcela 2/8", amountCents: 9999 },
    ]);
    // A parcelada permanece intocada: entra apenas como candidata a casar.
    expect(plan.toDeleteIds).toEqual([]);
  });

  it("sem linhas o plano vem vazio e preserva o total de ignoradas", () => {
    const plan = planInvoiceImport({
      lines: [],
      card,
      existing: [purchase({ id: "x" })],
      ignored: 4,
    });

    expect(plan).toEqual({
      monthKey: null,
      toDeleteIds: [],
      toInsert: [],
      toSkipMatched: [],
      ignored: 4,
      adjustedRows: [],
    });
  });
});
