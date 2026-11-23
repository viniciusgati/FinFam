import { afterEach, describe, expect, it } from "vitest";
import {
  EXPORT_TABLES,
  EXPORT_TABLE_NAMES,
  buildExportBundle,
  toCsvExport,
  toJsonExport,
  type ExportRow,
} from "./export-data";

const TIME_ZONE = "America/Sao_Paulo";
const GENERATED_AT = new Date("2026-10-15T12:00:00.000Z");

function normalize(value: string): string {
  return value.replace(/\u00a0/g, " ");
}

const incomeRow: ExportRow = {
  id: "inc_1",
  name: "Salário",
  amountCents: 123456,
  receiveDay: 5,
  active: true,
  startMonth: "2026-01",
  endMonth: null,
  createdAt: new Date("2026-10-03T02:30:00.000Z"),
  updatedAt: new Date("2026-10-04T10:00:00.000Z"),
};

const variableIncomeRow: ExportRow = {
  id: "vin_1",
  description: "Venda da bicicleta",
  amountCents: 35000,
  date: new Date("2026-10-03T02:30:00.000Z"),
  createdAt: new Date("2026-10-03T03:00:00.000Z"),
  updatedAt: new Date("2026-10-03T03:00:00.000Z"),
};

afterEach(() => {
  delete process.env.FINFAM_USER;
  delete process.env.FINFAM_PASS;
  delete process.env.FINFAM_SESSION_SECRET;
});

describe("EXPORT_TABLES", () => {
  it("lista as 11 tabelas do domínio na ordem de exportação com rótulos pt-BR", () => {
    expect(EXPORT_TABLE_NAMES).toEqual([
      "incomes",
      "variable_incomes",
      "fixed_expenses",
      "credit_cards",
      "variable_expenses",
      "card_purchases",
      "monthly_snapshots",
      "monthly_category_snapshots",
      "app_settings",
      "monthly_reviews",
      "shopping_items",
    ]);
    expect(EXPORT_TABLE_NAMES.map((name) => EXPORT_TABLES[name].label)).toEqual(
      [
        "Receitas",
        "Receitas variáveis",
        "Despesas fixas",
        "Cartões de crédito",
        "Despesas variáveis",
        "Compras no cartão",
        "Fechamentos mensais",
        "Fechamentos por categoria",
        "Configurações do app",
        "Revisões mensais",
        "Lista de compras",
      ],
    );
  });

  it("define o cabeçalho exato de shopping_items na ordem do schema", () => {
    const header = EXPORT_TABLES.shopping_items.columns
      .map((column) => column.key)
      .join(",");
    expect(header).toBe(
      "id,name,kind,category,quantity,estimatedUnitPriceCents,priceSource,priceSampleCount,priceFetchedAt,purchased,purchasedAt,addedOn,createdAt,updatedAt",
    );
  });

  it("define o cabeçalho exato de incomes na ordem do schema", () => {
    const header = EXPORT_TABLES.incomes.columns
      .map((column) => column.key)
      .join(",");
    expect(header).toBe(
      "id,name,amountCents,receiveDay,active,startMonth,endMonth,createdAt,updatedAt",
    );
  });
});

describe("buildExportBundle / toJsonExport", () => {
  it("inclui versao, geradoEm ISO, fuso e as 11 chaves de tabela", () => {
    const bundle = buildExportBundle({
      generatedAt: GENERATED_AT,
      timeZone: TIME_ZONE,
      tables: { incomes: [incomeRow] },
    });

    expect(bundle.versao).toBe(1);
    expect(bundle.geradoEm).toBe("2026-10-15T12:00:00.000Z");
    expect(bundle.fuso).toBe(TIME_ZONE);
    expect(Object.keys(bundle.tabelas)).toEqual(EXPORT_TABLE_NAMES);
  });

  it("preserva centavos como inteiro e datas de negócio no fuso da família", () => {
    const bundle = buildExportBundle({
      generatedAt: GENERATED_AT,
      timeZone: TIME_ZONE,
      tables: { incomes: [incomeRow], variable_incomes: [variableIncomeRow] },
    });

    const income = bundle.tabelas.incomes[0];
    expect(income.amountCents).toBe(123456);
    expect(typeof income.amountCents).toBe("number");
    expect(income.startMonth).toBe("2026-01");
    expect(income.endMonth).toBeNull();

    // 02:30Z ainda é dia 2 em São Paulo (UTC-3).
    expect(bundle.tabelas.variable_incomes[0].date).toBe("2026-10-02");
    expect(bundle.tabelas.variable_incomes[0].amountCents).toBe(35000);
  });

  it("serializa createdAt/updatedAt em ISO 8601 UTC preservando o instante", () => {
    const bundle = buildExportBundle({
      generatedAt: GENERATED_AT,
      timeZone: TIME_ZONE,
      tables: { incomes: [incomeRow] },
    });

    expect(bundle.tabelas.incomes[0].createdAt).toBe(
      "2026-10-03T02:30:00.000Z",
    );
    expect(bundle.tabelas.incomes[0].updatedAt).toBe(
      "2026-10-04T10:00:00.000Z",
    );
  });

  it("exporta shopping_items com preço em centavos e addedOn como YYYY-MM-DD", () => {
    const bundle = buildExportBundle({
      generatedAt: GENERATED_AT,
      timeZone: TIME_ZONE,
      tables: {
        shopping_items: [
          {
            id: "shop_1",
            name: "Leite",
            kind: "ESSENCIAL",
            category: "Mercado",
            quantity: 2,
            estimatedUnitPriceCents: 550,
            priceSource: "google_shopping",
            priceSampleCount: 3,
            priceFetchedAt: new Date("2026-10-04T10:00:00.000Z"),
            purchased: false,
            purchasedAt: null,
            addedOn: "2026-10-02",
            createdAt: new Date("2026-10-02T10:00:00.000Z"),
            updatedAt: new Date("2026-10-04T10:00:00.000Z"),
          },
        ],
      },
    });

    expect(bundle.tabelas.shopping_items[0]).toEqual({
      id: "shop_1",
      name: "Leite",
      kind: "ESSENCIAL",
      category: "Mercado",
      quantity: 2,
      estimatedUnitPriceCents: 550,
      priceSource: "google_shopping",
      priceSampleCount: 3,
      priceFetchedAt: "2026-10-04T10:00:00.000Z",
      purchased: false,
      purchasedAt: null,
      addedOn: "2026-10-02",
      createdAt: "2026-10-02T10:00:00.000Z",
      updatedAt: "2026-10-04T10:00:00.000Z",
    });
  });

  it("tabela sem registros vira array vazio no JSON", () => {
    const bundle = buildExportBundle({
      generatedAt: GENERATED_AT,
      timeZone: TIME_ZONE,
      tables: { incomes: [] },
    });

    expect(bundle.tabelas.incomes).toEqual([]);
    expect(bundle.tabelas.monthly_reviews).toEqual([]);

    const parsed = JSON.parse(toJsonExport(bundle)) as typeof bundle;
    expect(parsed.tabelas.incomes).toEqual([]);
    expect(parsed.tabelas.monthly_reviews).toEqual([]);
  });

  it("mantém apenas as colunas definidas em EXPORT_TABLES", () => {
    const bundle = buildExportBundle({
      generatedAt: GENERATED_AT,
      timeZone: TIME_ZONE,
      tables: { incomes: [{ ...incomeRow, segredo: "não exportar" }] },
    });

    expect(Object.keys(bundle.tabelas.incomes[0])).toEqual(
      EXPORT_TABLES.incomes.columns.map((column) => column.key),
    );
  });
});

describe("toCsvExport", () => {
  it("emite BOM e o cabeçalho na ordem exata de EXPORT_TABLES", () => {
    const csv = toCsvExport("incomes", [incomeRow], { timeZone: TIME_ZONE });
    const [firstLine] = csv.split("\n");

    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(firstLine).toBe(
      "\uFEFFid,name,amountCents,receiveDay,active,startMonth,endMonth,createdAt,updatedAt",
    );
  });

  it("formata centavos com formatCents e booleanos como true/false", () => {
    const csv = toCsvExport("incomes", [incomeRow], { timeZone: TIME_ZONE });
    const line = csv.split("\n")[1];

    expect(normalize(line)).toBe(
      'inc_1,Salário,"R$ 1.234,56",5,true,2026-01,,2026-10-03T02:30:00.000Z,2026-10-04T10:00:00.000Z',
    );
  });

  it("deixa célula vazia para null e serializa array como JSON compacto", () => {
    const settings: ExportRow = {
      id: "singleton",
      cycleStartDay: 5,
      savingsGoalCents: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    };
    const snapshot: ExportRow = {
      id: "snap_1",
      monthKey: "2026-09",
      incomeCents: 100000,
      fixedIncomeCents: 0,
      variableIncomeCents: 0,
      fixedExpensesCents: 0,
      variableExpensesCents: 0,
      cardExpensesCents: 0,
      consumedCents: 0,
      consumedPercent: 87.5,
      consumptionAvailableCents: 0,
      dailyAverageCents: 0,
      daysInMonth: 30,
      variableDailyCents: [100, 200],
      obligationDailyCents: [0, 500],
      createdAt: new Date("2026-10-01T00:00:00.000Z"),
      updatedAt: new Date("2026-10-01T00:00:00.000Z"),
    };

    const settingsLine = toCsvExport("app_settings", [settings]).split("\n")[1];
    expect(settingsLine).toBe(
      "singleton,5,,2026-01-01T00:00:00.000Z,2026-01-01T00:00:00.000Z",
    );

    const snapshotLine = toCsvExport("monthly_snapshots", [snapshot]).split(
      "\n",
    )[1];
    expect(snapshotLine).toContain('"[100,200]"');
    expect(snapshotLine).toContain('"[0,500]"');
    expect(snapshotLine).toContain("87.5");
  });

  it("tabela vazia gera somente o cabeçalho", () => {
    const csv = toCsvExport("monthly_reviews", []);

    expect(csv).toBe("\uFEFFid,monthKey,summary,createdAt,updatedAt\n");
    expect(csv.split("\n").filter((line) => line !== "")).toHaveLength(1);
  });

  it("escapa vírgula, aspas e quebra de linha conforme RFC 4180", () => {
    const row: ExportRow = {
      id: "rev_1",
      monthKey: "2026-10",
      summary: 'Resumo, "ótimo"\nfim',
      createdAt: new Date("2026-10-03T02:30:00.000Z"),
      updatedAt: new Date("2026-10-03T02:30:00.000Z"),
    };

    const csv = toCsvExport("monthly_reviews", [row]);

    expect(csv).toContain('"Resumo, ""ótimo""\nfim"');
  });

  it("neutraliza células iniciadas por =, +, - e @", () => {
    const summaries = ["=1+1", "+SOMA", "-10", "@usuario", "normal"];
    const rows: ExportRow[] = summaries.map((summary, index) => ({
      id: `rev_${index}`,
      monthKey: "2026-10",
      summary,
      createdAt: new Date("2026-10-01T00:00:00.000Z"),
      updatedAt: new Date("2026-10-01T00:00:00.000Z"),
    }));

    const csv = toCsvExport("monthly_reviews", rows);

    expect(csv).toContain("'=1+1");
    expect(csv).toContain("'+SOMA");
    expect(csv).toContain("'-10");
    expect(csv).toContain("'@usuario");
    expect(csv).toContain(",normal,");
  });

  it("serializa data de negócio no fuso injetado (dois fusos diferentes)", () => {
    const saoPaulo = toCsvExport(
      "variable_incomes",
      [variableIncomeRow],
      { timeZone: "America/Sao_Paulo" },
    );
    const utc = toCsvExport("variable_incomes", [variableIncomeRow], {
      timeZone: "UTC",
    });

    expect(saoPaulo.split("\n")[1]).toContain("2026-10-02");
    expect(utc.split("\n")[1]).toContain("2026-10-03");
  });

  it("não inclui segredos de ambiente nem quando estão definidos", () => {
    process.env.FINFAM_USER = "usuario-secreto";
    process.env.FINFAM_PASS = "senha-secreta";
    process.env.FINFAM_SESSION_SECRET = "segredo-da-sessao";

    const bundle = buildExportBundle({
      generatedAt: GENERATED_AT,
      timeZone: TIME_ZONE,
      tables: { incomes: [incomeRow], app_settings: [] },
    });
    const json = toJsonExport(bundle);
    const csv = toCsvExport("incomes", [incomeRow], { timeZone: TIME_ZONE });

    for (const output of [json, csv]) {
      expect(output).not.toContain("usuario-secreto");
      expect(output).not.toContain("senha-secreta");
      expect(output).not.toContain("segredo-da-sessao");
    }
  });
});
