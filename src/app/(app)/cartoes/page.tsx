import type { Metadata } from "next";
import CreditCardsManager, {
  type CardPurchaseData,
  type CreditCardData,
} from "@/components/CreditCardsManager";
import InvoiceImportPanel from "@/components/InvoiceImportPanel";
import { loadCategorySuggestions } from "@/lib/category-suggestions";
import { prisma } from "@/lib/db";
import { monthKey, monthLabel } from "@/lib/finance";
import { buildFutureCommitments } from "@/lib/future-commitments";
import { resolveReferenceDate } from "@/lib/invoices";
import { formatCents } from "@/lib/money";

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

  const futureCommitments = loadError
    ? []
    : buildFutureCommitments(
        purchases.flatMap((purchase) =>
          purchase.card
            ? [
                {
                  id: purchase.id,
                  description: purchase.description,
                  category: purchase.category,
                  purchaseDate: new Date(purchase.purchaseDate),
                  amountCents: purchase.amountCents,
                  installmentsTotal: purchase.installmentsTotal,
                  card: purchase.card,
                },
              ]
            : [],
        ),
        referenceMonthKey,
      );

  const categorySuggestions = await loadCategorySuggestions();

  return (
    <div className="space-y-8">
      <InvoiceImportPanel cards={cards} />
      {!loadError && (
        <section
          aria-label="Parcelas futuras por cartão"
          className="rounded-2xl border border-border bg-surface p-6 shadow-sm"
        >
          <h2 className="text-sm font-medium uppercase tracking-widest text-subtle">
            Parcelas dos próximos meses
          </h2>
          <p className="mt-1 text-sm text-foreground-muted">
            Mês-base da projeção: {monthLabel(referenceMonthKey)}.
          </p>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            {futureCommitments.map((month) => (
              <div
                key={month.monthKey}
                className="rounded-xl bg-surface-strong px-4 py-3"
              >
                <h3 className="text-xs font-medium uppercase tracking-wide text-subtle">
                  {monthLabel(month.monthKey)}
                </h3>
                <p className="text-xl font-bold tabular-nums text-foreground">
                  {formatCents(month.totalCents)}
                </p>
                {month.cards.length === 0 ? (
                  <p className="mt-2 text-sm text-subtle">Sem parcelas.</p>
                ) : (
                  <ul className="mt-2 space-y-1 text-sm">
                    {month.cards.map((card) => (
                      <li
                        key={card.cardId}
                        className="flex justify-between gap-4 text-foreground"
                      >
                        <span className="truncate">{card.cardName}</span>
                        <span className="tabular-nums">
                          {formatCents(card.amountCents)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
      <CreditCardsManager
        initialCards={cards}
        initialPurchases={purchases}
        referenceMonthKey={referenceMonthKey}
        initialError={loadError}
        categorySuggestions={categorySuggestions}
      />
    </div>
  );
}
