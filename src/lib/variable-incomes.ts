/**
 * Domínio e validação das entradas avulsas (não recorrentes).
 *
 * Diferente das entradas fixas (`Income`), uma entrada avulsa acontece uma vez
 * — venda de algo, saldo que sobrou etc. — e conta como renda do mês da `date`
 * (ver `loadDashboardData`) e no orçamento do ciclo financeiro (ver
 * `loadCycleAllowance`).
 *
 * Nenhuma função aqui acessa banco de dados ou rede — apenas validam, o que as
 * torna facilmente testáveis (ver variable-incomes.test.ts).
 */

import { z } from "zod";

export const createVariableIncomeSchema = z.object({
  description: z.string().trim().min(1),
  amountCents: z.number().int().positive(),
  date: z.coerce.date(),
});

export type CreateVariableIncomeInput = z.infer<
  typeof createVariableIncomeSchema
>;

export const updateVariableIncomeSchema = createVariableIncomeSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "Nenhum campo para atualizar",
  });

export type UpdateVariableIncomeInput = z.infer<
  typeof updateVariableIncomeSchema
>;
