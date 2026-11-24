/**
 * Forma de medir o consumo do ciclo na Home (história #380).
 *
 * `INCOME` é o comportamento histórico: o `%` compara o consumo do ciclo com a
 * renda. `VARIABLE_BUDGET` compara apenas o consumo variável com o que sobra
 * da renda depois dos gastos fixos. O modo é persistido em `AppSettings` e a
 * lógica pura fica aqui, sem banco/rede/`new Date()`.
 */

export const CONSUMPTION_MODES = ["INCOME", "VARIABLE_BUDGET"] as const;

export type ConsumptionMode = (typeof CONSUMPTION_MODES)[number];

/** Default retrocompatível: bancos sem a coluna continuam no modo renda. */
export const DEFAULT_CONSUMPTION_MODE: ConsumptionMode = "INCOME";
