import type { Metadata } from "next";
import CreditCardsManager, {
  type CardPurchaseData,
  type CreditCardData,
} from "@/components/CreditCardsManager";
import { loadCategorySuggestions } from "@/lib/category-suggestions";
import { prisma } from "@/lib/db";
import { monthKey } from "@/lib/finance";
import { resolveReferenceDate } from "@/lib/invoices";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Cartões — FinFam" };

export default async function CartoesPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string | string[] }>;
}) {
  const params = await searchParams;
  const mes = Array.isArray(params.mes) ? params.mes[0] : params.mes;
  const referenceDate = resolveReferenceDate(mes);
  const referenceMonthKey = monthKey(referenceDate);

  let cards: CreditCardData[] = [];
  let purchases: CardPurchaseData[] = [];
  let loadError: string | null = null;

  try {
    [cards, purchases] = await Promise.all([
      prisma.creditCard.findMany({
        orderBy: [{ name: "asc" }, { id: "asc" }],
      }),
      prisma.cardPurchase.findMany({
        orderBy: [{ purchaseDate: "asc" }, { id: "asc" }],
        include: { card: true },
      }),
    ]);
  } catch {
    loadError = "Não foi possível carregar cartões e compras. Tente novamente.";
  }

  const categorySuggestions = await loadCategorySuggestions();

  return (
    <CreditCardsManager
      initialCards={cards}
      initialPurchases={purchases}
      referenceMonthKey={referenceMonthKey}
      initialError={loadError}
      categorySuggestions={categorySuggestions}
    />
  );
}
