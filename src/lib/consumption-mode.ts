/**
 * Forma de medir o consumo do ciclo na Home (história #380).
 *
 * `INCOME` é o comportamento histórico: o `%` compara o consumo do ciclo com a
 * renda. `VARIABLE_BUDGET` compara apenas o consumo variável com o que sobra
 * da renda depois dos gastos fixos. O modo é persistido em `AppSettings` e a
 * lógica pura fica aqui, sem banco/rede/`new Date()`.
 *
 * Fórmulas (SPEC §4.9):
 * - `orçamento_variável = max(renda − gastos_fixos, 0)`;
 * - `percentual = round(consumo_variável / orçamento_variável × 100)` (0 sem
 *   denominador, nunca `NaN`/`Infinity`);
 * - `excesso = max(consumo_variável − orçamento_variável, 0)`;
 * - `pausa_por_dia = ceil(excesso / max(dias_restantes, 1))`;
 * - `diária_disponível = floor(disponível / max(dias_restantes, 1))`.
 *
 * A meta de economia **não** é subtraída neste modo e a projeção de fechamento
 * continua na base renda (ver `buildConsumptionModeView`).
 */

import {
  classifyLevel,
  type FinanceLevel,
} from "./finance";
import { formatCents } from "./money";

export const CONSUMPTION_MODES = ["INCOME", "VARIABLE_BUDGET"] as const;

export type ConsumptionMode = (typeof CONSUMPTION_MODES)[number];

/** Default retrocompatível: bancos sem a coluna continuam no modo renda. */
export const DEFAULT_CONSUMPTION_MODE: ConsumptionMode = "INCOME";

export const CONSUMPTION_MODE_TITLE = "Orçamento variável consumido";
export const CONSUMPTION_MODE_BUDGET_LABEL = "Orçamento variável";
export const CONSUMPTION_MODE_CONSUMED_LABEL = "Consumo variável";
export const CONSUMPTION_MODE_AVAILABLE_LABEL = "Ainda disponível";
export const CONSUMPTION_MODE_OVER_LABEL = "Estourado em";
export const CONSUMPTION_MODE_PROJECTION_LABEL = "Projeção até o fim do ciclo";
export const CONSUMPTION_MODE_NO_BUDGET_MESSAGE =
  "Sem orçamento variável: os gastos fixos consomem toda a renda do ciclo.";

/** Normaliza entradas não finitas (ou negativas, quando pedido) para 0. */
function safeCents(value: number): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  return value;
}

function daysFloor(days: number): number {
  return Number.isFinite(days) ? Math.max(days, 1) : 1;
}

export interface ConsumptionModeBudgetInput {
  mode: ConsumptionMode;
  incomeCents: number;
  fixedExpensesCents: number;
}

/**
 * Base comparada pelo modo. Em `VARIABLE_BUDGET` é o que sobra da renda depois
 * dos gastos fixos (nunca negativo); em `INCOME` é a própria renda.
 */
export function consumptionModeBudget(
  input: ConsumptionModeBudgetInput,
): number {
  const income = safeCents(input.incomeCents);
  if (input.mode === "INCOME") return income;
  return Math.max(income - safeCents(input.fixedExpensesCents), 0);
}

/**
 * Percentual do orçamento variável já consumido (arredondado). Sem orçamento
 * (`<= 0`) devolve `0` — ausência de denominador, não de gasto.
 */
export function consumptionModePercent(
  consumedCents: number,
  budgetCents: number,
): number {
  const budget = safeCents(budgetCents);
  if (budget <= 0) return 0;
  const percent = Math.round((safeCents(consumedCents) / budget) * 100);
  return Number.isFinite(percent) ? percent : 0;
}

export interface ConsumptionModePauseInput {
  consumedCents: number;
  budgetCents: number;
  /** Dias restantes da janela, contando hoje (piso em 1). */
  remainingDays: number;
}

export interface ConsumptionModePause {
  /** Quanto passou do orçamento (0 quando dentro). */
  excessCents: number;
  /** Quanto é preciso pausar por dia para fechar no limite (0 sem excesso). */
  pausePerDayCents: number;
}

/** Excesso sobre o orçamento e a pausa diária necessária para compensá-lo. */
export function consumptionModePause(
  input: ConsumptionModePauseInput,
): ConsumptionModePause {
  const budget = safeCents(input.budgetCents);
  const excessCents = Math.max(safeCents(input.consumedCents) - budget, 0);
  if (excessCents <= 0) {
    return { excessCents: 0, pausePerDayCents: 0 };
  }
  return {
    excessCents,
    pausePerDayCents: Math.ceil(excessCents / daysFloor(input.remainingDays)),
  };
}

/**
 * Quanto ainda dá para gastar por dia com o que restou do orçamento.
 * `Math.floor` e piso em `max(dias_restantes, 1)`.
 */
export function consumptionModeDailyAvailable(
  availableCents: number,
  remainingDays: number,
): number {
  const daily = Math.floor(safeCents(availableCents) / daysFloor(remainingDays));
  return Number.isFinite(daily) ? daily : 0;
}

export interface ConsumptionModeLevelInput {
  percent: number;
  budgetCents: number;
  consumedCents: number;
}

/**
 * Nível/criticidade do modo variável. `percent >= 100` é crítico; as demais
 * faixas seguem `classifyLevel` sobre `ratio = percent/100`. Sem orçamento, é
 * `red` quando houve consumo variável e `green` quando não houve.
 */
export function consumptionModeLevel(
  input: ConsumptionModeLevelInput,
): FinanceLevel {
  const budget = safeCents(input.budgetCents);
  if (budget <= 0) {
    return safeCents(input.consumedCents) > 0 ? "red" : "green";
  }
  const percent = Number.isFinite(input.percent)
    ? Math.max(input.percent, 0)
    : 0;
  return classifyLevel(percent / 100, percent, budget);
}

export interface ConsumptionModeColorInput {
  percent: number;
  budgetCents: number;
  consumedCents: number;
}

/**
 * `ratio` usado por `levelColor`/`heatColor` no modo variável:
 * `percent/100`, ou `2` quando não há orçamento e há consumo, `0` quando não há
 * orçamento nem consumo.
 */
export function consumptionModeColorRatio(
  input: ConsumptionModeColorInput,
): number {
  const budget = safeCents(input.budgetCents);
  if (budget <= 0) {
    return safeCents(input.consumedCents) > 0 ? 2 : 0;
  }
  const percent = Number.isFinite(input.percent)
    ? Math.max(input.percent, 0)
    : 0;
  return percent / 100;
}

function remainingDaysLabel(days: number): string {
  return days === 1 ? "no dia restante" : `nos ${days} dias restantes`;
}

function pauseDaysLabel(days: number): string {
  return days === 1 ? "pelo dia restante" : `por ${days} dias restantes`;
}

/** Texto de folga: quanto ainda cabe por dia dentro do orçamento variável. */
export function consumptionModeWithinBudgetFeedback(
  dailyAvailableCents: number,
  remainingDays: number,
): string {
  return (
    "Dentro do orçamento variável, ainda dá para gastar " +
    `${formatCents(safeCents(dailyAvailableCents))} por dia ` +
    `${remainingDaysLabel(remainingDays)}.`
  );
}

/** Texto de estouro: excesso acumulado e pausa diária necessária. */
export function consumptionModeOverBudgetFeedback(
  excessCents: number,
  pausePerDayCents: number,
  remainingDays: number,
): string {
  return (
    `Estourado em ${formatCents(safeCents(excessCents))}. ` +
    `Pausa por dia ${formatCents(safeCents(pausePerDayCents))} ` +
    `${pauseDaysLabel(remainingDays)}.`
  );
}

/** Texto acessível da barra de progresso no modo variável. */
export function consumptionModeAriaValueText(percent: number): string {
  const safe = Number.isFinite(percent) ? Math.max(percent, 0) : 0;
  return `${safe}% do orçamento variável consumido`;
}

export interface ConsumptionModeStat {
  key: "budget" | "variable-consumed" | "available" | "projection";
  label: string;
  value: string;
  detail: string | null;
}

export interface ConsumptionModeViewInput {
  mode: ConsumptionMode;
  incomeCents: number;
  fixedExpensesCents: number;
  /** Consumo variável do ciclo: avulsos + compras do cartão pela data. */
  variableConsumedCents: number;
  /** Projeção de fechamento na base renda (`FinanceStatus.projectedCents`). */
  projectedCents: number;
  /** Dias restantes da diária, contando hoje. */
  remainingDays: number;
}

export interface ConsumptionModeView {
  title: string;
  percent: number;
  ariaValueText: string;
  stats: ConsumptionModeStat[];
  feedback: string;
  level: FinanceLevel;
  colorRatio: number;
  budgetCents: number;
  consumedCents: number;
  excessCents: number;
  pausePerDayCents: number;
  dailyAvailableCents: number;
  /** `false` quando os gastos fixos consomem toda a renda do ciclo. */
  hasVariableBudget: boolean;
}

/**
 * View model do card no modo `VARIABLE_BUDGET`. Devolve `null` no modo
 * `INCOME`, preservando o comportamento histórico (`buildMonthSpendStats`).
 * A projeção continua na base renda e não é ocultada.
 */
export function buildConsumptionModeView(
  input: ConsumptionModeViewInput,
): ConsumptionModeView | null {
  if (input.mode === "INCOME") return null;

  const budgetCents = consumptionModeBudget({
    mode: input.mode,
    incomeCents: input.incomeCents,
    fixedExpensesCents: input.fixedExpensesCents,
  });
  const consumedCents = safeCents(input.variableConsumedCents);
  const remainingDays = daysFloor(input.remainingDays);
  const percent = consumptionModePercent(consumedCents, budgetCents);
  const { excessCents, pausePerDayCents } = consumptionModePause({
    consumedCents,
    budgetCents,
    remainingDays,
  });
  const hasVariableBudget = budgetCents > 0;
  const dailyAvailableCents = consumptionModeDailyAvailable(
    Math.max(budgetCents - consumedCents, 0),
    remainingDays,
  );

  const available: ConsumptionModeStat =
    excessCents > 0
      ? {
          key: "available",
          label: CONSUMPTION_MODE_OVER_LABEL,
          value: formatCents(excessCents),
          detail: null,
        }
      : {
          key: "available",
          label: CONSUMPTION_MODE_AVAILABLE_LABEL,
          value: formatCents(Math.max(budgetCents - consumedCents, 0)),
          detail: null,
        };

  const feedback = !hasVariableBudget
    ? CONSUMPTION_MODE_NO_BUDGET_MESSAGE
    : excessCents > 0
      ? consumptionModeOverBudgetFeedback(
          excessCents,
          pausePerDayCents,
          remainingDays,
        )
      : consumptionModeWithinBudgetFeedback(
          dailyAvailableCents,
          remainingDays,
        );

  return {
    title: CONSUMPTION_MODE_TITLE,
    percent,
    ariaValueText: consumptionModeAriaValueText(percent),
    stats: [
      {
        key: "budget",
        label: CONSUMPTION_MODE_BUDGET_LABEL,
        value: formatCents(budgetCents),
        detail: null,
      },
      {
        key: "variable-consumed",
        label: CONSUMPTION_MODE_CONSUMED_LABEL,
        value: formatCents(consumedCents),
        detail: null,
      },
      available,
      {
        key: "projection",
        label: CONSUMPTION_MODE_PROJECTION_LABEL,
        value: formatCents(safeCents(input.projectedCents)),
        detail: null,
      },
    ],
    feedback,
    level: consumptionModeLevel({ percent, budgetCents, consumedCents }),
    colorRatio: consumptionModeColorRatio({ percent, budgetCents, consumedCents }),
    budgetCents,
    consumedCents,
    excessCents,
    pausePerDayCents,
    dailyAvailableCents,
    hasVariableBudget,
  };
}
