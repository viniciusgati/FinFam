/**
 * Máscaras puras de competência (mês) e data para campos de formulário.
 *
 * Formatos: competência = `AAAA-MM` (6 dígitos, hífen após o 4º) e data =
 * `DD/MM/AAAA` (8 dígitos, `/` após o 2º e o 5º — dia primeiro, coerente com
 * `formatDate` das listas). Nenhuma função aqui acessa DOM, banco ou rede:
 * a validação de negócio permanece na camada existente de cada formulário.
 */

/** Prefixo ISO `AAAA-MM-DD` (com ou sem horário) capturado em 3 grupos. */
const ISO_PREFIX = /^(\d{4})-(\d{2})-(\d{2})/;

/** Mantém apenas os dígitos do texto, descartando separadores e demais caracteres. */
function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

/** Confere mês 1–12 e dia real do mês (inclusive bissexto) para ano de 4 dígitos. */
function isValidDateParts(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1) return false;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return day <= daysInMonth;
}

/**
 * Formata uma competência no padrão `AAAA-MM` a partir do texto digitado.
 *
 * Caracteres não-dígito são descartados e o excedente a 6 dígitos é ignorado.
 * A validação do mês (01–12) não acontece aqui: fica na camada de validação
 * existente do formulário.
 */
export function maskMonth(value: string): string {
  const digits = onlyDigits(value).slice(0, 6);
  if (digits.length <= 4) return digits;
  return `${digits.slice(0, 4)}-${digits.slice(4)}`;
}

/**
 * Formata uma data no padrão `DD/MM/AAAA` a partir do texto digitado.
 *
 * Um valor ISO colado (`2026-10-07`, inclusive com horário) é reconhecido e
 * convertido para `07/10/2026`; nos demais casos os caracteres não-dígito são
 * descartados e o excedente a 8 dígitos é ignorado. Um separador final nunca
 * sobra (ex.: `07/10/` → `07/10`), o que faz o Backspace removê-lo junto.
 */
export function maskDate(value: string): string {
  const iso = ISO_PREFIX.exec(value.trim());
  if (iso) {
    const [, year, month, day] = iso;
    return `${day}/${month}/${year}`;
  }
  const digits = onlyDigits(value).slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

/**
 * Converte uma data mascarada `DD/MM/AAAA` para ISO `AAAA-MM-DD`.
 * Retorna `null` quando o texto está vazio, incompleto ou não corresponde a
 * uma data real (ex.: `31/02/2026`).
 */
export function dateMaskToIso(mask: string): string | null {
  const digits = onlyDigits(mask);
  if (digits.length !== 8) return null;
  const day = Number(digits.slice(0, 2));
  const month = Number(digits.slice(2, 4));
  const year = Number(digits.slice(4, 8));
  if (!isValidDateParts(year, month, day)) return null;
  return `${digits.slice(4, 8)}-${digits.slice(2, 4)}-${digits.slice(0, 2)}`;
}

/**
 * Converte uma data ISO `AAAA-MM-DD` (com ou sem horário) para a máscara
 * `DD/MM/AAAA`. Retorna `""` para vazio ou entrada fora do padrão.
 */
export function isoToDateMask(iso: string): string {
  const match = ISO_PREFIX.exec(iso.trim());
  if (!match) return "";
  const [, year, month, day] = match;
  if (!isValidDateParts(Number(year), Number(month), Number(day))) return "";
  return `${day}/${month}/${year}`;
}
