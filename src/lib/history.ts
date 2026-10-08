/**
 * View model puro da evolução mensal exibida em `/historico`.
 *
 * Nenhuma função aqui acessa banco ou rede — recebe os snapshots mensais já
 * carregados e devolve as linhas já rotuladas/classificadas, o que as torna
 * testáveis sem DOM (ver history.test.ts).
 */

import {
  classifyLevel,
  levelLabel,
  monthLabel,
  type FinanceLevel,
} from "./finance";

/** Campos mínimos de um snapshot mensal para montar a linha de histórico. */
export interface MonthHistorySnapshot {
  monthKey: string;
  incomeCents: number;
  consumedCents: number;
  consumedPercent: number;
}

export interface MonthHistoryEntry {
  monthKey: string;
  /** Rótulo pt-BR do mês (ex.: "setembro de 2026"). */
  label: string;
  /** Total gasto no mês, em centavos. */
  totalCents: number;
  /** Percentual da renda consumida, arredondado para exibição. */
  percent: number;
  level: FinanceLevel;
  /** Rótulo textual do nível, legível sem depender da cor. */
  levelLabel: string;
}

/**
 * Monta a linha de cada mês fechado, do mais recente para o mais antigo.
 *
 * O nível reutiliza os limiares do dashboard (`classifyLevel`), usando
 * `ratio = consumedPercent / 100` para os meses já fechados.
 */
export function buildMonthHistory(
  snapshots: MonthHistorySnapshot[],
): MonthHistoryEntry[] {
  return [...snapshots]
    .sort((a, b) => b.monthKey.localeCompare(a.monthKey))
    .map((snapshot) => {
      const level = classifyLevel(
        snapshot.consumedPercent / 100,
        snapshot.consumedPercent,
        snapshot.incomeCents,
      );
      return {
        monthKey: snapshot.monthKey,
        label: monthLabel(snapshot.monthKey),
        totalCents: snapshot.consumedCents,
        percent: Math.round(snapshot.consumedPercent),
        level,
        levelLabel: levelLabel(level),
      };
    });
}
