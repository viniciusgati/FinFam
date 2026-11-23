/**
 * Serializador puro da exportação de dados da família (JSON e CSV).
 *
 * `EXPORT_TABLES` é a única fonte da verdade de nomes, rótulos pt-BR, ordem
 * das colunas e tipos — consumida tanto pela rota `/api/export` quanto pelo
 * bloco "Baixar meus dados" em `/configuracoes`. Nada aqui acessa banco ou
 * rede; `generatedAt` e `timeZone` são injetados.
 *
 * Regras de serialização:
 * - valores monetários seguem em centavos inteiros no JSON e formatados com
 *   `formatCents` no CSV;
 * - datas de negócio (`date`, `purchaseDate`) viram `YYYY-MM-DD` no fuso da
 *   família; `createdAt`/`updatedAt` viram ISO 8601 UTC para preservar o
 *   instante; meses (`YYYY-MM`) permanecem como estão persistidos;
 * - o CSV usa vírgula, quebra `\n`, aspas RFC 4180, BOM UTF-8 e neutraliza
 *   células iniciadas por `=`, `+`, `-` ou `@` (prevenção de fórmula).
 */
import { formatCents } from "./money";
import { DEFAULT_TIME_ZONE, zonedDateParts } from "./time";

export type ExportColumnType =
  | "string"
  | "integer"
  | "number"
  | "cents"
  | "boolean"
  | "date"
  | "datetime"
  | "json";

export interface ExportColumn {
  key: string;
  type: ExportColumnType;
}

export interface ExportTableDefinition {
  label: string;
  columns: readonly ExportColumn[];
}

/** Linha crua vinda do Prisma (ou de uma fixture em teste). */
export type ExportRow = Record<string, unknown>;

export const EXPORT_TABLES = {
  incomes: {
    label: "Receitas",
    columns: [
      { key: "id", type: "string" },
      { key: "name", type: "string" },
      { key: "amountCents", type: "cents" },
      { key: "receiveDay", type: "integer" },
      { key: "active", type: "boolean" },
      { key: "startMonth", type: "string" },
      { key: "endMonth", type: "string" },
      { key: "createdAt", type: "datetime" },
      { key: "updatedAt", type: "datetime" },
    ],
  },
  variable_incomes: {
    label: "Receitas variáveis",
    columns: [
      { key: "id", type: "string" },
      { key: "description", type: "string" },
      { key: "amountCents", type: "cents" },
      { key: "date", type: "date" },
      { key: "createdAt", type: "datetime" },
      { key: "updatedAt", type: "datetime" },
    ],
  },
  fixed_expenses: {
    label: "Despesas fixas",
    columns: [
      { key: "id", type: "string" },
      { key: "name", type: "string" },
      { key: "amountCents", type: "cents" },
      { key: "dueDay", type: "integer" },
      { key: "category", type: "string" },
      { key: "active", type: "boolean" },
      { key: "startMonth", type: "string" },
      { key: "endMonth", type: "string" },
      { key: "createdAt", type: "datetime" },
      { key: "updatedAt", type: "datetime" },
    ],
  },
  credit_cards: {
    label: "Cartões de crédito",
    columns: [
      { key: "id", type: "string" },
      { key: "name", type: "string" },
      { key: "limitCents", type: "cents" },
      { key: "closingDay", type: "integer" },
      { key: "dueDay", type: "integer" },
      { key: "active", type: "boolean" },
      { key: "createdAt", type: "datetime" },
      { key: "updatedAt", type: "datetime" },
    ],
  },
  variable_expenses: {
    label: "Despesas variáveis",
    columns: [
      { key: "id", type: "string" },
      { key: "description", type: "string" },
      { key: "amountCents", type: "cents" },
      { key: "date", type: "date" },
      { key: "category", type: "string" },
      { key: "paymentMethod", type: "string" },
      { key: "paid", type: "boolean" },
      { key: "creditCardId", type: "string" },
      { key: "createdAt", type: "datetime" },
      { key: "updatedAt", type: "datetime" },
    ],
  },
  card_purchases: {
    label: "Compras no cartão",
    columns: [
      { key: "id", type: "string" },
      { key: "cardId", type: "string" },
      { key: "description", type: "string" },
      { key: "amountCents", type: "cents" },
      { key: "purchaseDate", type: "date" },
      { key: "category", type: "string" },
      { key: "installmentNumber", type: "integer" },
      { key: "installmentsTotal", type: "integer" },
      { key: "createdAt", type: "datetime" },
      { key: "updatedAt", type: "datetime" },
    ],
  },
  monthly_snapshots: {
    label: "Fechamentos mensais",
    columns: [
      { key: "id", type: "string" },
      { key: "monthKey", type: "string" },
      { key: "incomeCents", type: "cents" },
      { key: "fixedIncomeCents", type: "cents" },
      { key: "variableIncomeCents", type: "cents" },
      { key: "fixedExpensesCents", type: "cents" },
      { key: "variableExpensesCents", type: "cents" },
      { key: "cardExpensesCents", type: "cents" },
      { key: "consumedCents", type: "cents" },
      { key: "consumedPercent", type: "number" },
      { key: "consumptionAvailableCents", type: "cents" },
      { key: "dailyAverageCents", type: "cents" },
      { key: "daysInMonth", type: "integer" },
      { key: "variableDailyCents", type: "json" },
      { key: "obligationDailyCents", type: "json" },
      { key: "createdAt", type: "datetime" },
      { key: "updatedAt", type: "datetime" },
    ],
  },
  monthly_category_snapshots: {
    label: "Fechamentos por categoria",
    columns: [
      { key: "id", type: "string" },
      { key: "monthKey", type: "string" },
      { key: "categoryKey", type: "string" },
      { key: "categoryLabel", type: "string" },
      { key: "amountCents", type: "cents" },
      { key: "createdAt", type: "datetime" },
      { key: "updatedAt", type: "datetime" },
    ],
  },
  app_settings: {
    label: "Configurações do app",
    columns: [
      { key: "id", type: "string" },
      { key: "cycleStartDay", type: "integer" },
      { key: "savingsGoalCents", type: "cents" },
      { key: "createdAt", type: "datetime" },
      { key: "updatedAt", type: "datetime" },
    ],
  },
  monthly_reviews: {
    label: "Revisões mensais",
    columns: [
      { key: "id", type: "string" },
      { key: "monthKey", type: "string" },
      { key: "summary", type: "string" },
      { key: "createdAt", type: "datetime" },
      { key: "updatedAt", type: "datetime" },
    ],
  },
  shopping_items: {
    label: "Lista de compras",
    columns: [
      { key: "id", type: "string" },
      { key: "name", type: "string" },
      { key: "kind", type: "string" },
      { key: "category", type: "string" },
      { key: "quantity", type: "integer" },
      { key: "estimatedUnitPriceCents", type: "cents" },
      { key: "priceSource", type: "string" },
      { key: "priceSampleCount", type: "integer" },
      { key: "priceFetchedAt", type: "datetime" },
      { key: "purchased", type: "boolean" },
      { key: "purchasedAt", type: "datetime" },
      { key: "addedOn", type: "string" },
      { key: "createdAt", type: "datetime" },
      { key: "updatedAt", type: "datetime" },
    ],
  },
} as const satisfies Record<string, ExportTableDefinition>;

export type ExportTableName = keyof typeof EXPORT_TABLES;

/** Nomes das tabelas na ordem em que aparecem em `EXPORT_TABLES`. */
export const EXPORT_TABLE_NAMES = Object.keys(EXPORT_TABLES) as ExportTableName[];

export function isExportTableName(value: string): value is ExportTableName {
  return Object.prototype.hasOwnProperty.call(EXPORT_TABLES, value);
}

export type ExportRecord = Record<string, unknown>;

export interface ExportInput {
  /** Instante de geração injetado (testes e rota). */
  generatedAt: Date;
  /** Fuso da família; default `America/Sao_Paulo`. */
  timeZone?: string;
  /** Linhas cruas por tabela; tabela ausente vira `[]`. */
  tables: Partial<Record<ExportTableName, readonly ExportRow[]>>;
}

export interface ExportBundle {
  versao: 1;
  geradoEm: string;
  fuso: string;
  tabelas: Record<ExportTableName, ExportRecord[]>;
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

/** Data de negócio como `YYYY-MM-DD` no fuso informado. */
function toIsoDay(value: Date, timeZone: string): string {
  const { year, month, day } = zonedDateParts(value, timeZone);
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function toIsoDayValue(value: unknown, timeZone: string): string {
  if (value instanceof Date) return toIsoDay(value, timeZone);
  return String(value);
}

function toIsoInstant(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

/** Valor como aparece no JSON (null preservado, datas normalizadas). */
function serializeForJson(
  type: ExportColumnType,
  value: unknown,
  timeZone: string,
): unknown {
  if (value === null || value === undefined) return null;

  switch (type) {
    case "date":
      return toIsoDayValue(value, timeZone);
    case "datetime":
      return toIsoInstant(value);
    case "cents":
    case "integer":
    case "number":
      return typeof value === "number" ? value : Number(value);
    case "boolean":
      return Boolean(value);
    case "json":
      return value;
    case "string":
    default:
      return String(value);
  }
}

/** Converte uma linha crua na linha exportada (colunas e ordem do schema). */
function serializeRow(
  definition: ExportTableDefinition,
  row: ExportRow,
  timeZone: string,
): ExportRecord {
  const record: ExportRecord = {};
  for (const column of definition.columns) {
    record[column.key] = serializeForJson(
      column.type,
      row[column.key],
      timeZone,
    );
  }
  return record;
}

/**
 * Monta o bundle do JSON completo: `{ versao, geradoEm, fuso, tabelas }`.
 * Tabelas ausentes na entrada aparecem como `[]`.
 */
export function buildExportBundle(input: ExportInput): ExportBundle {
  const fuso = input.timeZone ?? DEFAULT_TIME_ZONE;
  const tabelas = {} as Record<ExportTableName, ExportRecord[]>;

  for (const name of EXPORT_TABLE_NAMES) {
    const definition = EXPORT_TABLES[name];
    const rows = input.tables[name] ?? [];
    tabelas[name] = rows.map((row) => serializeRow(definition, row, fuso));
  }

  return {
    versao: 1,
    geradoEm: input.generatedAt.toISOString(),
    fuso,
    tabelas,
  };
}

/** Serializa o bundle como JSON legível. */
export function toJsonExport(bundle: ExportBundle): string {
  return JSON.stringify(bundle, null, 2);
}

/** Prefixa `'` em célula que começa com caractere de fórmula. */
function neutralizeFormula(value: string): string {
  return /^[=+\-@]/.test(value) ? `'${value}` : value;
}

/** Aspas RFC 4180 apenas quando necessário (vírgula, aspas ou quebra). */
function escapeCsvField(value: string): string {
  if (!/[",\r\n]/.test(value)) return value;
  return `"${value.replace(/"/g, '""')}"`;
}

function serializeForCsv(
  type: ExportColumnType,
  value: unknown,
  timeZone: string,
): string {
  if (value === null || value === undefined) return "";

  switch (type) {
    case "date":
      return toIsoDayValue(value, timeZone);
    case "datetime":
      return toIsoInstant(value);
    case "cents":
      return formatCents(Number(value));
    case "boolean":
      return value ? "true" : "false";
    case "json":
      return JSON.stringify(value);
    case "integer":
    case "number":
      return String(value);
    case "string":
    default:
      return String(value);
  }
}

/**
 * CSV de uma tabela: BOM UTF-8, cabeçalho exatamente na ordem de
 * `EXPORT_TABLES[tabela].columns` e uma linha por registro. Tabela vazia
 * devolve apenas o cabeçalho.
 */
export function toCsvExport(
  table: ExportTableName,
  rows: readonly ExportRow[],
  options: { timeZone?: string } = {},
): string {
  const definition = EXPORT_TABLES[table];
  const timeZone = options.timeZone ?? DEFAULT_TIME_ZONE;

  const header = definition.columns.map((column) => column.key).join(",");
  const lines = [header];

  for (const row of rows) {
    const cells = definition.columns.map((column) => {
      const raw = serializeForCsv(column.type, row[column.key], timeZone);
      return escapeCsvField(neutralizeFormula(raw));
    });
    lines.push(cells.join(","));
  }

  return `\uFEFF${lines.join("\n")}\n`;
}
