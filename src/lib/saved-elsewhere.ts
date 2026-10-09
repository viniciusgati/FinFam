import { monthLabel } from "@/lib/finance";

interface SavedElsewhereInput {
  baseMessage: string;
  savedMonthKey: string;
  selectedMonthKey: string;
}

/**
 * Mensagem de sucesso de um lançamento salvo: se o mês salvo é o mês
 * selecionado, devolve `baseMessage` cru (sem ponto); caso contrário,
 * informa o mês de destino em pt-BR para a pessoa não concluir que o
 * item sumiu (ex.: "Gasto criado para outro mês (novembro de 2026).").
 */
export function savedElsewhereMessage({
  baseMessage,
  savedMonthKey,
  selectedMonthKey,
}: SavedElsewhereInput): string {
  if (savedMonthKey === selectedMonthKey) return baseMessage;
  return `${baseMessage} para outro mês (${monthLabel(savedMonthKey)}).`;
}
