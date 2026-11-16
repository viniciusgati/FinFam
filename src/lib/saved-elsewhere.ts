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

interface CycleSavedElsewhereInput {
  baseMessage: string;
  savedDate: string;
  selectedMonthKey: string;
  windowStart?: string;
  windowNextStart?: string;
}

/**
 * Versão ciente da janela do ciclo exibido: qualquer data em
 * `[windowStart, windowNextStart)` conta como "dentro", mesmo quando o ciclo
 * começa depois do dia 1. Fora da janela, a mensagem informa o mês da data.
 */
export function cycleSavedElsewhereMessage({
  baseMessage,
  savedDate,
  selectedMonthKey,
  windowStart,
  windowNextStart,
}: CycleSavedElsewhereInput): string {
  const savedMonthKey = savedDate.slice(0, 7);

  if (windowStart && windowNextStart) {
    const inWindow =
      savedDate >= windowStart && savedDate < windowNextStart;
    if (inWindow) return baseMessage;

    return savedElsewhereMessage({
      baseMessage,
      savedMonthKey,
      selectedMonthKey:
        savedMonthKey === selectedMonthKey ? "" : selectedMonthKey,
    });
  }

  return savedElsewhereMessage({
    baseMessage,
    savedMonthKey,
    selectedMonthKey,
  });
}
