import { redirect } from "next/navigation";
import AppNav from "@/components/AppNav";
import FixedItemsManager, {
  type FixedItem,
} from "@/components/FixedItemsManager";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function EntradasPage() {
  const session = await getSession();
  if (!session) redirect("/login");

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
    <main className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-3xl space-y-8">
        <AppNav current="/entradas" />
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
      </div>
    </main>
  );
}
