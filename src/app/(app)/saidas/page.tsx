import type { Metadata } from "next";
import FixedItemsManager, {
  type FixedItem,
} from "@/components/FixedItemsManager";
import { loadCategorySuggestions } from "@/lib/category-suggestions";
import { prisma } from "@/lib/db";
import { monthKey } from "@/lib/finance";
import { resolveReferenceDate } from "@/lib/invoices";
import {
  buildEndingSoonWarnings,
  endingSoonLabel,
} from "@/lib/upcoming";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Saídas — FinFam" };

export default async function SaidasPage() {
  let items: FixedItem[] = [];
  let loadError: string | null = null;

  try {
    items = await prisma.fixedExpense.findMany({
      orderBy: [{ name: "asc" }, { id: "asc" }],
    });
  } catch {
    loadError = "Não foi possível carregar as saídas. Tente novamente.";
  }

  const now = new Date();
  const referenceMonthKey = monthKey(resolveReferenceDate(undefined, now));
  const endingSoonLabels = Object.fromEntries(
    buildEndingSoonWarnings(
      items.map((item) => ({
        id: item.id,
        name: item.name,
        amountCents: item.amountCents,
        dueDay: item.dueDay ?? 1,
        active: item.active,
        startMonth: item.startMonth,
        endMonth: item.endMonth,
      })),
      referenceMonthKey,
    ).flatMap((warning) =>
      warning.id ? [[warning.id, endingSoonLabel(warning)] as const] : [],
    ),
  );

  const categorySuggestions = await loadCategorySuggestions();

  return (
    <FixedItemsManager
      endpoint="/api/fixed-expenses"
      title="Saídas fixas"
      dayField="dueDay"
      dayLabel="Dia de vencimento"
      dayVerb="vence"
      showCategory
      emptyMessage="Nenhuma saída fixa cadastrada ainda."
      ctaLabel="Cadastrar saída"
      savedMessage="Saída salva."
      deactivatedMessage="Saída desativada."
      reactivatedMessage="Saída reativada."
      fallbackErrorMessage="Não foi possível salvar. Tente novamente."
      initialItems={items}
      initialError={loadError}
      categorySuggestions={categorySuggestions}
      endingSoonLabels={endingSoonLabels}
    />
  );
}
