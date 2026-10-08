import type { Metadata } from "next";
import FixedItemsManager, {
  type FixedItem,
} from "@/components/FixedItemsManager";
import { loadCategorySuggestions } from "@/lib/category-suggestions";
import { prisma } from "@/lib/db";

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
    />
  );
}
