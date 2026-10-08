/**
 * Motor puro das mensagens acionáveis do card "Ajuda à família" (história
 * #258).
 *
 * Nenhuma função aqui acessa banco ou rede: lê apenas os agregados já
 * calculados pelo dashboard (categorias do mês, snapshots da janela, renda,
 * contas fixas e o consumo variável do dia) e devolve textos determinísticos,
 * testáveis sem DOM (ver family-insights.test.ts).
 *
 * A precedência é **ordem, não supressão**: a renda insuficiente vem sempre
 * primeiro, depois os alertas de categoria e por fim a variação diária; os
 * itens seguintes continuam sendo exibidos.
 */

import { categoryKey, categoryLabel } from "./categories";
import { formatCents } from "./money";

export type FamilyInsightTone = "warning" | "positive" | "neutral";

export interface FamilyInsight {
  id: string;
  tone: FamilyInsightTone;
  /** Marcador textual acessível (`null` quando o tom não tem marcador). */
  marker: string | null;
  text: string;
}

/** Gasto do mês em uma categoria (mesma forma de `CategoryBreakdownItem`). */
export interface FamilyCategoryAmount {
  category: string;
  amountCents: number;
}

/** Snapshot de um mês fechado com as categorias, base de comparação. */
export interface FamilyInsightSnapshot {
  monthKey: string;
  categories: FamilyCategoryAmount[];
}

export interface FamilyInsightInput {
  /** Mês aberto na tela (`?mes=`), podendo ser fechado. */
  referenceMonthKey: string;
  /** Categorias do mês de referência. */
  currentCategories: FamilyCategoryAmount[];
  /** Meses fechados estritamente anteriores (janela de comparação). */
  windowSnapshots: FamilyInsightSnapshot[];
  monthlyIncomeCents: number;
  fixedExpensesCents: number;
  /** Consumo variável do dia; `null` em mês fechado (sem "hoje"). */
  todayVariableSpendCents: number | null;
  /** Referência diária (> 0); `null`/`0` suprime a variação diária. */
  dailyReferenceCents: number | null;
}

/** Dispara a variação diária quando `hoje >= 1,5× a referência`. */
export const DAILY_VARIATION_FACTOR = 1.5;
/** Dispara o alerta de categoria quando `atual >= 1,2× a média`. */
export const CATEGORY_ABOVE_FACTOR = 1.2;
/** Excesso mínimo (centavos) para o alerta de categoria. */
export const CATEGORY_MIN_SURPLUS_CENTS = 5000;
/** Máximo de alertas de categoria exibidos. */
export const MAX_CATEGORY_ALERTS = 2;

export const FAMILY_INCOME_SHORTFALL_TEXT =
  "Sua renda não cobre as contas fixas deste mês. Revise as contas fixas ou busque uma entrada extra.";
export const FAMILY_POSITIVE_TEXT =
  "Tudo certo: nenhuma categoria ficou acima da média dos últimos meses.";
export const FAMILY_EMPTY_TEXT =
  "Ainda não há base de comparação suficiente para gerar uma ajuda.";

/** Marcadores textuais acessíveis por tom. */
export const FAMILY_WARNING_MARKER = "Atenção";
export const FAMILY_POSITIVE_MARKER = "Tudo certo";

export interface CategoryAverage {
  /** Média da categoria na janela (pode ser fracionária). */
  averageCents: number;
  /** Nº de meses da janela com snapshot (1..4); `0` sem base. */
  months: number;
}

/**
 * Média da categoria na janela. O denominador é o **número de snapshots da
 * janela** (mês com snapshot sem a categoria conta 0; mês sem snapshot não
 * entra). Sem snapshot, `averageCents`/`months` são `0`.
 */
export function categoryAverage(
  targetKey: string,
  windowSnapshots: FamilyInsightSnapshot[],
): CategoryAverage {
  const months = windowSnapshots.length;
  if (months === 0) return { averageCents: 0, months: 0 };

  const totalCents = windowSnapshots.reduce((total, snapshot) => {
    const monthTotal = snapshot.categories.reduce(
      (sum, item) =>
        categoryKey(item.category) === targetKey
          ? sum + item.amountCents
          : sum,
      0,
    );
    return total + monthTotal;
  }, 0);

  return { averageCents: totalCents / months, months };
}

export interface CategoryAlert {
  categoryKey: string;
  /** Rótulo exibido (`NO_CATEGORY_LABEL` quando vazio/ausente). */
  category: string;
  currentCents: number;
  averageCents: number;
  /** `atual − média`, sempre `> 0` para um alerta. */
  surplusCents: number;
  /** Percentual inteiro arredondado acima da média. */
  percentAbove: number;
  /** Nº real de meses com snapshot usados na média. */
  months: number;
}

/**
 * Categorias do mês de referência ≥ 20% acima da média **e** com ≥ R$ 50,00 de
 * excesso, agrupadas por `categoryKey`. Retorna no máximo
 * {@link MAX_CATEGORY_ALERTS}, ordenadas por desvio absoluto desc, desempate
 * por `categoryKey` asc e, por fim, rótulo asc (`pt-BR`). Média `0` não gera
 * alerta. Reutilizada pela IA para derivar desvios anônimos.
 */
export function categoryAlerts(
  currentCategories: FamilyCategoryAmount[],
  windowSnapshots: FamilyInsightSnapshot[],
): CategoryAlert[] {
  if (windowSnapshots.length === 0) return [];

  const currentByKey = new Map<
    string,
    { category: string; amountCents: number }
  >();
  for (const item of currentCategories) {
    const key = categoryKey(item.category);
    const existing = currentByKey.get(key);
    if (existing) {
      existing.amountCents += item.amountCents;
    } else {
      currentByKey.set(key, {
        category: categoryLabel(item.category),
        amountCents: item.amountCents,
      });
    }
  }

  const alerts: CategoryAlert[] = [];
  for (const [key, current] of currentByKey) {
    const { averageCents, months } = categoryAverage(key, windowSnapshots);
    if (averageCents <= 0) continue;
    if (current.amountCents < CATEGORY_ABOVE_FACTOR * averageCents) continue;
    const surplusCents = current.amountCents - averageCents;
    if (surplusCents < CATEGORY_MIN_SURPLUS_CENTS) continue;

    alerts.push({
      categoryKey: key,
      category: current.category,
      currentCents: current.amountCents,
      averageCents,
      surplusCents,
      percentAbove: Math.round((surplusCents / averageCents) * 100),
      months,
    });
  }

  alerts.sort(
    (a, b) =>
      b.surplusCents - a.surplusCents ||
      a.categoryKey.localeCompare(b.categoryKey) ||
      a.category.localeCompare(b.category, "pt-BR"),
  );

  return alerts.slice(0, MAX_CATEGORY_ALERTS);
}

/** Múltiplo com 1 casa decimal e vírgula (ex.: `1,5`). */
export function formatFactor(value: number): string {
  return value.toFixed(1).replace(".", ",");
}

/**
 * Monta a lista de insights na ordem da história: renda insuficiente →
 * alertas de categoria → variação diária. Se nada disparou, devolve o
 * `positive` (há snapshot na janela) ou o `neutral` de falta de base.
 */
export function buildFamilyInsights(
  input: FamilyInsightInput,
): FamilyInsight[] {
  const insights: FamilyInsight[] = [];

  if (input.fixedExpensesCents >= input.monthlyIncomeCents) {
    insights.push({
      id: "income-shortfall",
      tone: "warning",
      marker: FAMILY_WARNING_MARKER,
      text: FAMILY_INCOME_SHORTFALL_TEXT,
    });
  }

  for (const alert of categoryAlerts(
    input.currentCategories,
    input.windowSnapshots,
  )) {
    insights.push({
      id: `category-${alert.categoryKey}`,
      tone: "warning",
      marker: FAMILY_WARNING_MARKER,
      text: `A categoria ${alert.category} ficou ${alert.percentAbove}% acima da média dos últimos ${alert.months} meses.`,
    });
  }

  const reference = input.dailyReferenceCents;
  const today = input.todayVariableSpendCents;
  if (
    today !== null &&
    reference !== null &&
    reference > 0 &&
    today >= DAILY_VARIATION_FACTOR * reference
  ) {
    insights.push({
      id: "daily-variation",
      tone: "warning",
      marker: FAMILY_WARNING_MARKER,
      text:
        `Hoje você gastou ${formatCents(today)}; é ` +
        `${formatFactor(today / reference)}× a sua média diária de ` +
        `${formatCents(reference)}.`,
    });
  }

  if (insights.length > 0) return insights;

  if (input.windowSnapshots.length > 0) {
    return [
      {
        id: "positive",
        tone: "positive",
        marker: FAMILY_POSITIVE_MARKER,
        text: FAMILY_POSITIVE_TEXT,
      },
    ];
  }

  return [
    {
      id: "neutral",
      tone: "neutral",
      marker: null,
      text: FAMILY_EMPTY_TEXT,
    },
  ];
}
