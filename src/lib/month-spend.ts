/**
 * View model puro dos valores em R$ do card principal ("Renda do mês
 * consumida"): quanto entra, quanto já saiu, quanto sobra e a projeção de
 * fechamento do mês.
 *
 * Nenhuma função aqui acessa banco ou rede — só formata os centavos já
 * calculados por `computeFinanceStatus`, o que torna os textos exatos
 * testáveis sem DOM (ver month-spend.test.ts). O `%` protagonista continua
 * sendo a fonte de verdade; estes rótulos apenas o decompõem em dinheiro.
 */

import { formatCents } from "./money";

export type MonthSpendStatKey =
  | "income"
  | "consumed"
  | "available"
  | "projection";

export interface MonthSpendStat {
  key: MonthSpendStatKey;
  label: string;
  value: string;
  /** Texto auxiliar curto, ou `null` quando não há o que acrescentar. */
  detail: string | null;
}

export interface MonthSpendStatsInput {
  incomeCents: number;
  /** Consumo do mês (fixas + fatura + avulsos), mesma base do `%`. */
  consumedCents: number;
  /** Projeção de fechamento em centavos (`FinanceStatus.projectedCents`). */
  projectedCents: number;
  /** Percentual já arredondado exibido no card (0..∞). */
  consumedPercent: number;
}

/**
 * Valores úteis do mês na ordem de leitura: quanto entra, quanto já saiu,
 * quanto sobra (ou quanto estourou) e quanto deve sair até o fim do mês no
 * ritmo atual. Sempre retorna as 4 posições, na mesma ordem, para o layout
 * não pular de lugar.
 */
export function buildMonthSpendStats(
  input: MonthSpendStatsInput,
): MonthSpendStat[] {
  const income = Math.max(input.incomeCents, 0);
  const consumed = Math.max(input.consumedCents, 0);
  const remaining = income - consumed;

  const available: MonthSpendStat =
    remaining >= 0
      ? {
          key: "available",
          label: "Ainda disponível",
          value: formatCents(remaining),
          detail: null,
        }
      : {
          key: "available",
          label: "Estourado em",
          value: formatCents(-remaining),
          detail: null,
        };

  return [
    {
      key: "income",
      label: "Renda do mês",
      value: formatCents(income),
      detail: null,
    },
    {
      key: "consumed",
      label: "Já consumido",
      value: formatCents(consumed),
      detail: `${Math.round(input.consumedPercent)}% da renda`,
    },
    available,
    {
      key: "projection",
      label: "Projeção até o fim do mês",
      value: formatCents(Math.max(input.projectedCents, 0)),
      detail: null,
    },
  ];
}
