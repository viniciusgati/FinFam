"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import {
  cardAdjustmentFeedback,
  CARD_AMOUNT_ERROR,
  CARD_SELECTION_ERROR,
  validateCardAdjustment,
} from "@/lib/card-adjustment";
import { formatCents } from "@/lib/money";

interface QuickCardAdjustmentCardProps {
  /** Cartões ativos, já ordenados por nome no servidor. */
  cards: Array<{ id: string; name: string }>;
  /** Total de competência por cartão no mês-alvo (ausente = 0). */
  totalsByCard: Record<string, number>;
  /** Mês de fatura exibido no dashboard (YYYY-MM). */
  monthKey: string;
}

interface SetTotalResponse {
  created?: boolean;
  currentCents?: number;
  amountCents?: number;
  error?: string;
}

interface Feedback {
  tone: "success" | "error";
  message: string;
}

const FIELD_CLASSES =
  "w-full rounded-lg border border-border-strong bg-surface-raised px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2";

const INVALID_FIELD_CLASSES = "border-red-500";

export default function QuickCardAdjustmentCard({
  cards,
  totalsByCard,
  monthKey,
}: QuickCardAdjustmentCardProps) {
  const router = useRouter();
  const [cardId, setCardId] = useState("");
  const [amount, setAmount] = useState("");
  const [totals, setTotals] = useState(totalsByCard);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [saving, setSaving] = useState(false);

  // O "Valor atual" vem do servidor: quando o dashboard é recarregado
  // (`router.refresh()`), as props mudam e o total exibido acompanha.
  useEffect(() => {
    setTotals(totalsByCard);
  }, [totalsByCard]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);

    const validation = validateCardAdjustment({ cardId, amount });
    setError(validation.error);
    if (
      validation.error !== null ||
      validation.cardId === null ||
      validation.totalCents === null
    ) {
      return;
    }

    const selectedCardId = validation.cardId;
    const targetCents = validation.totalCents;

    setSaving(true);
    try {
      const response = await fetch("/api/card-invoices/set-total", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cardId: selectedCardId,
          monthKey,
          totalCents: targetCents,
        }),
      });

      if (response.status === 201) {
        const data = (await response.json().catch(() => null)) as
          | SetTotalResponse
          | null;
        const diffCents = data?.amountCents ?? targetCents;
        setFeedback({
          tone: "success",
          message: cardAdjustmentFeedback({
            status: "created",
            diffCents,
            totalCents: targetCents,
          }),
        });
        setTotals((previous) => ({ ...previous, [selectedCardId]: targetCents }));
        setAmount("");
        router.refresh();
        return;
      }

      if (response.status === 200) {
        const data = (await response.json().catch(() => null)) as
          | SetTotalResponse
          | null;
        const currentCents = data?.currentCents ?? targetCents;
        setFeedback({
          tone: "success",
          message: cardAdjustmentFeedback({
            status: "no-op",
            totalCents: currentCents,
          }),
        });
        setTotals((previous) => ({
          ...previous,
          [selectedCardId]: currentCents,
        }));
        setAmount("");
        router.refresh();
        return;
      }

      if (response.status === 400) {
        const data = (await response.json().catch(() => null)) as
          | SetTotalResponse
          | null;
        setFeedback({
          tone: "error",
          message: cardAdjustmentFeedback({
            status: "below",
            error: data?.error ?? "Não foi possível ajustar a fatura.",
          }),
        });
        return;
      }

      setFeedback({
        tone: "error",
        message: cardAdjustmentFeedback({ status: "network" }),
      });
    } catch {
      setFeedback({
        tone: "error",
        message: cardAdjustmentFeedback({ status: "network" }),
      });
    } finally {
      setSaving(false);
    }
  }

  if (cards.length === 0) {
    return (
      <section className="rounded-2xl border border-border bg-surface p-6 text-left shadow-sm">
        <h2 className="text-lg font-semibold text-foreground">
          Ajuste rápido do cartão
        </h2>
        <p className="mt-2 text-sm text-foreground-muted">
          Nenhum cartão ativo. Cadastre um cartão para ajustar a fatura.
        </p>
        <Link
          href="/cartoes"
          className="mt-4 inline-block rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
        >
          Cadastrar cartão
        </Link>
      </section>
    );
  }

  const selectionInvalid = error === CARD_SELECTION_ERROR;
  const amountInvalid = error === CARD_AMOUNT_ERROR;
  const currentCents = cardId ? (totals[cardId] ?? 0) : null;
  const message = error ?? feedback?.message ?? null;

  return (
    <section className="rounded-2xl border border-border bg-surface p-6 text-left shadow-sm">
      <h2 className="text-lg font-semibold text-foreground">
        Ajuste rápido do cartão
      </h2>
      <p className="mt-1 text-sm text-foreground-muted">
        Informe o total já consumido no cartão para atualizar a fatura do mês
        exibido, sem sair do dashboard.
      </p>

      <form onSubmit={handleSubmit} noValidate className="mt-4 space-y-4">
        <div className="grid gap-4 md:grid-cols-3">
          <label className="flex flex-col gap-1 text-sm font-medium text-foreground-muted">
            Cartão
            <select
              value={cardId}
              onChange={(event) => setCardId(event.target.value)}
              aria-invalid={selectionInvalid}
              className={`${FIELD_CLASSES} ${
                selectionInvalid ? INVALID_FIELD_CLASSES : ""
              }`}
            >
              <option value="">Selecione um cartão</option>
              {cards.map((card) => (
                <option key={card.id} value={card.id}>
                  {card.name}
                </option>
              ))}
            </select>
          </label>

          <div className="flex flex-col gap-1 text-sm font-medium text-foreground-muted">
            <span>Valor atual</span>
            <span className="rounded-lg border border-border-strong bg-surface-raised px-3 py-2 text-sm text-foreground">
              {currentCents === null ? "—" : formatCents(currentCents)}
            </span>
          </div>

          <label className="flex flex-col gap-1 text-sm font-medium text-foreground-muted">
            Novo total (R$)
            <input
              type="text"
              inputMode="decimal"
              placeholder="1.234,56"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              aria-invalid={amountInvalid}
              className={`${FIELD_CLASSES} ${
                amountInvalid ? INVALID_FIELD_CLASSES : ""
              }`}
            />
          </label>
        </div>

        <div className="flex flex-col gap-2">
          <button
            type="submit"
            disabled={saving}
            aria-busy={saving}
            className="self-start rounded-lg bg-emerald-600 px-5 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Salvando…" : "Salvar"}
          </button>

          <div
            role="status"
            aria-live="polite"
            className={`min-h-5 text-sm ${
              feedback?.tone === "error" || error !== null
                ? "text-red-400"
                : "text-emerald-300"
            }`}
          >
            {message}
          </div>
        </div>
      </form>
    </section>
  );
}
