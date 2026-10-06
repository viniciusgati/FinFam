/**
 * Conversão entre reais digitados (pt-BR) e centavos inteiros.
 *
 * A UI aceita valores como "1.234,56" (ponto de milhar, vírgula decimal) e
 * persiste em centavos (`123456`). Nenhuma função aqui acessa banco ou rede.
 */

/**
 * Converte um valor em reais digitado pelo usuário para centavos.
 * Retorna `null` quando o texto está vazio, não é numérico ou não é positivo.
 */
export function parseAmountToCents(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const normalized = trimmed.replace(/\s/g, "");
  const decimal = normalized.replace(/\./g, "").replace(",", ".");

  if (!/^\d+(\.\d{1,2})?$/.test(decimal)) return null;

  const cents = Math.round(Number(decimal) * 100);
  return Number.isFinite(cents) && cents > 0 ? cents : null;
}

/** Formata centavos como moeda brasileira (ex.: `123456` → `R$ 1.234,56`). */
export function formatCents(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}
