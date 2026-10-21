/**
 * Parser puro do CSV de fatura no padrão do Nubank (história #269).
 *
 * Entrada: texto UTF-8 (BOM tolerado) com cabeçalho obrigatório
 * `date,title,amount`, data em `YYYY-MM-DD` e valor em formato pt-BR
 * (`1,92`, `1.234,56`, `- 17,60`). Nenhuma função aqui acessa banco ou rede.
 *
 * Saída: linhas na ordem do arquivo, valores em centavos inteiros —
 * `positives` (importáveis), `negatives` (pagamentos/estornos, com valor
 * negativo, fora do conjunto importável) e `invalid` (data/valor malformado
 * ou zero, com o número da linha). Cabeçalho divergente não lança exceção:
 * volta em `headerError` (pt-BR).
 */

export interface InvoiceCsvRow {
  /** Número da linha no arquivo (1-based; o cabeçalho é a linha 1). */
  line: number;
  /** Data normalizada em `YYYY-MM-DD`. */
  date: string;
  title: string;
  /** Valor em centavos (positivo nas `positives`, negativo nas `negatives`). */
  amountCents: number;
}

export interface InvoiceCsvInvalidRow {
  /** Número da linha no arquivo (1-based). */
  line: number;
  reason: "columns" | "date" | "title" | "amount";
}

export interface InvoiceCsvParseResult {
  positives: InvoiceCsvRow[];
  negatives: InvoiceCsvRow[];
  invalid: InvoiceCsvInvalidRow[];
  headerError?: string;
}

interface RawRow {
  line: number;
  fields: string[];
}

const HEADER_FIELDS = ["date", "title", "amount"];

/**
 * Divide o texto em linhas de campos, respeitando aspas (`""` = aspas
 * escapadas) e quebras de linha dentro de campo. Linhas em branco são
 * descartadas. `line` é a linha do arquivo (1-based) onde a linha começa.
 */
function parseCsvRows(text: string): RawRow[] {
  const rows: RawRow[] = [];
  let fields: string[] = [];
  let field = "";
  let inQuotes = false;
  let line = 1;
  let rowStartLine = 1;

  const pushField = (): void => {
    fields.push(field);
    field = "";
  };

  const pushRow = (): void => {
    pushField();
    if (!fields.every((value) => value.trim() === "")) {
      rows.push({ line: rowStartLine, fields });
    }
    fields = [];
  };

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else if (char === "\r") {
        if (text[i + 1] === "\n") {
          // CRLF dentro de campo entre aspas: o `\n` seguinte conta a linha e
          // o `\r` não vira conteúdo (mesmo tratamento do campo não aspas).
          continue;
        }
        // CR único dentro de aspas: quebra de linha legada (estilo Mac).
        line += 1;
        field += "\n";
      } else {
        if (char === "\n") line += 1;
        field += char;
      }
      continue;
    }
    if (char === '"' && field === "") {
      inQuotes = true;
      continue;
    }
    if (char === ",") {
      pushField();
      continue;
    }
    if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") continue;
      line += 1;
      pushRow();
      rowStartLine = line;
      continue;
    }
    field += char;
  }

  if (field !== "" || fields.length > 0) pushRow();
  return rows;
}

/** Valida `YYYY-MM-DD` no calendário real e devolve a data normalizada. */
function parseIsoDate(value: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) return null;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (day < 1 || day > daysInMonth) return null;
  return `${match[1]}-${match[2]}-${match[3]}`;
}

/**
 * Converte um valor pt-BR para centavos com sinal (`- 17,60` → `-1760`).
 * Devolve `null` quando o texto não é numérico ou resulta em zero.
 */
function parseAmountCents(value: string): number | null {
  let normalized = value.replace(/\s/g, "");
  let negative = false;
  if (normalized.startsWith("-")) {
    negative = true;
    normalized = normalized.slice(1);
  }

  if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(normalized)) {
    normalized = normalized.replace(/\./g, "").replace(",", ".");
  } else {
    normalized = normalized.replace(",", ".");
  }

  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;

  const cents = Math.round(Number(normalized) * 100);
  if (!Number.isFinite(cents) || cents === 0) return null;
  return negative ? -cents : cents;
}

/**
 * Interpreta o texto de um CSV de fatura Nubank. Nunca lança exceção:
 * cabeçalho divergente volta em `headerError` e linhas malformadas entram em
 * `invalid`, sem derrubar o parse das demais.
 */
export function parseNubankInvoiceCsv(text: string): InvoiceCsvParseResult {
  const rows = parseCsvRows(text.replace(/^\uFEFF/, ""));

  if (rows.length === 0) {
    return {
      positives: [],
      negatives: [],
      invalid: [],
      headerError: 'Cabeçalho inválido: era esperado "date,title,amount".',
    };
  }

  const header = rows[0].fields.map((field) => field.trim().toLowerCase());
  if (
    header.length !== HEADER_FIELDS.length ||
    header.some((field, index) => field !== HEADER_FIELDS[index])
  ) {
    return {
      positives: [],
      negatives: [],
      invalid: [],
      headerError: 'Cabeçalho inválido: era esperado "date,title,amount".',
    };
  }

  const positives: InvoiceCsvRow[] = [];
  const negatives: InvoiceCsvRow[] = [];
  const invalid: InvoiceCsvInvalidRow[] = [];

  for (const row of rows.slice(1)) {
    if (row.fields.length < 3) {
      invalid.push({ line: row.line, reason: "columns" });
      continue;
    }
    const [rawDate, rawTitle] = row.fields;
    // A vírgula decimal do valor pode vir sem aspas (padrão Nubank), gerando
    // campos extras: o valor é sempre a última coluna, então é remontado.
    const rawAmount = row.fields.slice(2).join(",");
    const date = parseIsoDate(rawDate);
    if (!date) {
      invalid.push({ line: row.line, reason: "date" });
      continue;
    }
    const title = rawTitle.trim();
    if (!title) {
      invalid.push({ line: row.line, reason: "title" });
      continue;
    }
    const amountCents = parseAmountCents(rawAmount);
    if (amountCents === null) {
      invalid.push({ line: row.line, reason: "amount" });
      continue;
    }
    const rowEntry: InvoiceCsvRow = { line: row.line, date, title, amountCents };
    if (amountCents > 0) positives.push(rowEntry);
    else negatives.push(rowEntry);
  }

  return { positives, negatives, invalid };
}
