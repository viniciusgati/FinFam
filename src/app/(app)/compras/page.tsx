import type { Metadata } from "next";
import ShoppingItemsManager from "@/components/ShoppingItemsManager";
import RetryButton from "@/components/RetryButton";
import { todayISO } from "@/lib/quick-expense";
import { loadActiveShoppingItems } from "@/lib/shopping-items";
import type { ShoppingItem } from "@/lib/shopping-list";

export const metadata: Metadata = { title: "Lista de compras — FinFam" };

export const dynamic = "force-dynamic";

export default async function ComprasPage() {
  const today = todayISO();

  let items: ShoppingItem[] = [];
  let loadFailed = false;

  try {
    items = await loadActiveShoppingItems();
  } catch {
    loadFailed = true;
  }

  if (loadFailed) {
    return (
      <section
        role="alert"
        aria-live="assertive"
        className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center gap-6 rounded-2xl p-8 text-center"
      >
        <header className="space-y-1">
          <p className="text-sm font-medium uppercase tracking-widest text-subtle">
            Lista de compras
          </p>
          <h1 className="text-3xl font-bold text-foreground">
            Não foi possível carregar a lista de compras.
          </h1>
        </header>
        <RetryButton />
      </section>
    );
  }

  return <ShoppingItemsManager initialItems={items} today={today} />;
}
