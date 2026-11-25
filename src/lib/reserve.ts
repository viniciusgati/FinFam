/**
 * Reserva de emergência: parsing do saldo guardado e cliente da rota de
 * confirmação. Funções puras (ou com `fetchImpl` injetável) para rodar sem DOM.
 *
 * `ReserveSnapshot` é a fonte de verdade do saldo; a sobra do período é uma
 * estimativa de fluxo. Diferente dos demais valores monetários, `0` é válido:
 * significa "confirmei que não tenho reserva".
 */

import { parseAmountToCents } from "./money";

export const RESERVE_FORM_LABEL = "Saldo guardado (R$)";
export const RESERVE_FORM_BUTTON = "Salvar saldo";
export const RESERVE_FORM_SUCCESS = "Saldo confirmado";
export const RESERVE_FORM_INVALID =
  "Informe um valor maior ou igual a zero";
export const RESERVE_FORM_ERROR =
  "Não foi possível salvar o saldo. Tente novamente.";

/** Converte o texto do formulário em centavos; `0` é aceito, vazio/inválido não. */
export function parseReserveAmountInput(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^0+([.,]0{1,2})?$/.test(trimmed)) return 0;
  return parseAmountToCents(trimmed);
}

/** Valor inicial do input (`"1.600,00"`), ou `""` quando ainda não confirmado. */
export function reserveAmountInputValue(cents: number | null): string {
  if (cents === null) return "";
  return (cents / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export interface SaveReserveSnapshotParams {
  monthKey: string;
  amountCents: number;
  fetchImpl?: typeof fetch;
}

export interface SaveReserveSnapshotResult {
  ok: boolean;
  error: string | null;
}

/**
 * Confirma o saldo na rota `/api/reserve`. Nunca lança: rede, JSON inválido ou
 * status ≠ 2xx viram `{ ok: false, error }` para o formulário exibir.
 */
export async function saveReserveSnapshot(
  params: SaveReserveSnapshotParams,
): Promise<SaveReserveSnapshotResult> {
  const doFetch =
    params.fetchImpl ??
    ((input: RequestInfo | URL, init?: RequestInit) => fetch(input, init));

  try {
    const response = await doFetch("/api/reserve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        monthKey: params.monthKey,
        amountCents: params.amountCents,
      }),
    });
    const body = (await response.json().catch(() => null)) as
      | { error?: unknown }
      | null;

    if (!response.ok) {
      const error =
        typeof body?.error === "string" && body.error
          ? body.error
          : RESERVE_FORM_ERROR;
      return { ok: false, error };
    }

    return { ok: true, error: null };
  } catch {
    return { ok: false, error: RESERVE_FORM_ERROR };
  }
}
