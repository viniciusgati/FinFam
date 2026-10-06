import { redirect } from "next/navigation";
import AppNav from "@/components/AppNav";
import FixedItemsManager, {
  type FixedItem,
} from "@/components/FixedItemsManager";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function SaidasPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  let items: FixedItem[] = [];
  let loadError: string | null = null;

  try {
    items = await prisma.fixedExpense.findMany({
      orderBy: [{ name: "asc" }, { id: "asc" }],
    });
  } catch {
    loadError = "Não foi possível carregar as saídas. Tente novamente.";
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-3xl space-y-8">
        <AppNav current="/saidas" />
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
        />
      </div>
    </main>
  );
}
