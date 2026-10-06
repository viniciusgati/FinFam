import type { Metadata } from "next";
import FixedItemsManager, {
  type FixedItem,
} from "@/components/FixedItemsManager";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Cadastrar entradas — FinFam" };

export default async function EntradasPage() {
  let items: FixedItem[] = [];
  let loadError: string | null = null;

  try {
    items = await prisma.income.findMany({
      orderBy: [{ name: "asc" }, { id: "asc" }],
    });
  } catch {
    loadError = "Não foi possível carregar as entradas. Tente novamente.";
  }

  return (
    <FixedItemsManager
      endpoint="/api/incomes"
      title="Entradas fixas"
      dayField="receiveDay"
      dayLabel="Dia de recebimento"
      dayVerb="recebe"
      showCategory={false}
      emptyMessage="Nenhuma entrada cadastrada ainda."
      ctaLabel="Cadastrar entrada"
      savedMessage="Entrada salva."
      deactivatedMessage="Entrada desativada."
      reactivatedMessage="Entrada reativada."
      fallbackErrorMessage="Não foi possível salvar. Tente novamente."
      initialItems={items}
      initialError={loadError}
    />
  );
}
