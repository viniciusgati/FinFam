"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { IMPORT_FAILURE_MESSAGE } from "@/lib/invoice-import";
import { formatCents } from "@/lib/money";

/** Modo da requisição em voo: pré-visualização (dryRun) ou confirmação. */
export type InvoiceImportMode = "preview" | "confirm";

export interface InvoiceImportCardOption {
  id: string;
  name: string;
}

/** Resumo devolvido pela rota em `dryRun: true`. */
export interface InvoiceImportPreviewSummary {
  monthKey: string;
  toImport: number;
  toRemove: number;
  toMatch: number;
  ignored: number;
  totalCents: number;
}

/** Resumo devolvido pela rota após a confirmação persistida. */
export interface InvoiceImportConfirmation {
  imported: number;
  removed: number;
  matched: number;
  ignored: number;
}

const MONTH_NAMES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

/** "Competência: setembro/2026" — mês por extenso no formato da história. */
export function competenceSummaryText(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number);
  return `Competência: ${MONTH_NAMES[month - 1]}/${year}`;
}

/** "9 a importar · 2 a remover · 1 a casar · 4 a ignorar". */
export function countsSummaryText(
  summary: Pick<
    InvoiceImportPreviewSummary,
    "toImport" | "toRemove" | "toMatch" | "ignored"
  >,
): string {
  return (
    `${summary.toImport} a importar · ${summary.toRemove} a remover · ` +
    `${summary.toMatch} a casar · ${summary.ignored} a ignorar`
  );
}

/** "Total a importar: R$ 3.251,70" (formato pt-BR de `formatCents`). */
export function importTotalText(totalCents: number): string {
  return `Total a importar: ${formatCents(totalCents)}`;
}

/** "Fatura substituída: 9 importadas, 2 removidas, 1 casada, 4 ignoradas." */
export function confirmationStatusText(
  summary: InvoiceImportConfirmation,
): string {
  return (
    `Fatura substituída: ${summary.imported} importadas, ` +
    `${summary.removed} removidas, ${summary.matched} casadas, ` +
    `${summary.ignored} ignoradas.`
  );
}

export interface InvoiceImportOutcome {
  preview: InvoiceImportPreviewSummary | null;
  confirmation: InvoiceImportConfirmation | null;
  error: string | null;
}

export interface ExecuteInvoiceImportParams {
  mode: InvoiceImportMode;
  cardId: string;
  /** Arquivo escolhido na UI, lido com `File.text()` e enviado em JSON. */
  file: { text: () => Promise<string> };
  fetchImpl?: typeof fetch;
  /** Chamado só na confirmação persistida — a página usa `router.refresh()`. */
  onImported?: () => void;
}

/**
 * Lê o CSV, envia `{cardId, csv}` (sem multipart) para a rota de importação
 * e traduz a resposta em `InvoiceImportOutcome`. Rede, JSON inválido ou erro
 * da rota viram `error` (pt-BR) — nunca lançam exceção.
 */
export async function executeInvoiceImport(
  params: ExecuteInvoiceImportParams,
): Promise<InvoiceImportOutcome> {
  const doFetch =
    params.fetchImpl ??
    ((input: RequestInfo | URL, init?: RequestInit) => fetch(input, init));
  const empty: InvoiceImportOutcome = {
    preview: null,
    confirmation: null,
    error: null,
  };

  try {
    const csv = await params.file.text();
    const payload: { cardId: string; csv: string; dryRun?: true } = {
      cardId: params.cardId,
      csv,
    };
    if (params.mode === "preview") payload.dryRun = true;

    const response = await doFetch("/api/card-invoices/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = (await response.json().catch(() => null)) as
      | ({ error?: unknown } & Record<string, unknown>)
      | null;

    if (!response.ok || !data) {
      const error =
        typeof data?.error === "string" && data.error
          ? data.error
          : IMPORT_FAILURE_MESSAGE;
      return { ...empty, error };
    }

    if (params.mode === "preview") {
      return {
        ...empty,
        preview: data as unknown as InvoiceImportPreviewSummary,
      };
    }

    params.onImported?.();
    return {
      ...empty,
      confirmation: data as unknown as InvoiceImportConfirmation,
    };
  } catch {
    return { ...empty, error: IMPORT_FAILURE_MESSAGE };
  }
}

export interface InvoiceImportBodyProps {
  cards: InvoiceImportCardOption[];
  cardId: string;
  hasFile: boolean;
  busy: InvoiceImportMode | null;
  preview: InvoiceImportPreviewSummary | null;
  status: string | null;
  error: string | null;
  onCardChange: (cardId: string) => void;
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onPreview: () => void;
  onConfirm: () => void;
}

/**
 * Apresentação pura do painel: recebe todo o estado como propriedade, então
 * os estados (carregando, resumo, sucesso e erro) são verificáveis com
 * `renderToStaticMarkup`.
 */
export function InvoiceImportBody({
  cards,
  cardId,
  hasFile,
  busy,
  preview,
  status,
  error,
  onCardChange,
  onFileChange,
  onPreview,
  onConfirm,
}: InvoiceImportBodyProps) {
  const actionsDisabled = !cardId || !hasFile || busy !== null;

  return (
    <section className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-foreground">
        Importar fatura (CSV)
      </h2>
      <p className="mt-1 text-sm text-foreground-muted">
        Substitui os lançamentos à vista da competência detectada pelo CSV.
        Compras parceladas permanecem intactas.
      </p>

      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end">
        <label className="block min-w-0 flex-1 space-y-1">
          <span className="text-sm font-medium text-foreground-muted">
            Cartão
          </span>
          <select
            value={cardId}
            onChange={(event) => onCardChange(event.target.value)}
            disabled={busy !== null}
            className="w-full rounded-lg border border-border-strong bg-surface-raised px-3 py-2 text-foreground outline-none focus:border-emerald-500 disabled:opacity-60"
          >
            <option value="">Selecione um cartão</option>
            {cards.map((card) => (
              <option key={card.id} value={card.id}>
                {card.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block min-w-0 flex-1 space-y-1">
          <span className="text-sm font-medium text-foreground-muted">
            Arquivo CSV da fatura
          </span>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={onFileChange}
            disabled={busy !== null}
            className="block w-full text-sm text-foreground-muted file:mr-3 file:rounded-lg file:border file:border-border-strong file:bg-surface-raised file:px-4 file:py-2 file:font-medium file:text-foreground disabled:opacity-60"
          />
        </label>
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onPreview}
          disabled={actionsDisabled}
          className="rounded-lg bg-emerald-600 px-5 py-2 font-medium text-white transition hover:bg-emerald-700 disabled:opacity-60"
        >
          {busy === "preview" ? "Pré-visualizando…" : "Pré-visualizar"}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={actionsDisabled}
          className="rounded-lg border border-border-strong px-5 py-2 font-medium text-foreground transition hover:bg-surface-raised disabled:opacity-60"
        >
          {busy === "confirm" ? "Importando…" : "Substituir competência"}
        </button>
      </div>

      {busy !== null && (
        <p
          role="status"
          aria-live="polite"
          className="mt-4 rounded-xl border border-border bg-surface-raised px-4 py-3 text-sm font-medium text-foreground"
        >
          {busy === "preview" ? "Lendo fatura…" : "Substituindo fatura…"}
        </p>
      )}

      {preview !== null && (
        <div className="mt-4 space-y-1 rounded-xl border border-border bg-surface-raised px-4 py-3 text-sm">
          <p className="font-medium text-foreground">
            {competenceSummaryText(preview.monthKey)}
          </p>
          <p className="text-foreground-muted">{countsSummaryText(preview)}</p>
          <p className="text-foreground-muted">
            {importTotalText(preview.totalCents)}
          </p>
        </div>
      )}

      {status !== null && (
        <p
          role="status"
          className="mt-4 rounded-xl border border-emerald-800 bg-emerald-950 px-4 py-3 text-sm font-medium text-emerald-200"
        >
          {status}
        </p>
      )}

      {error !== null && (
        <p
          role="alert"
          aria-live="assertive"
          className="mt-4 rounded-lg border border-red-800 bg-red-950 px-4 py-3 text-sm text-red-200"
        >
          {error}
        </p>
      )}
    </section>
  );
}

export interface InvoiceImportPanelProps {
  cards: InvoiceImportCardOption[];
}

/**
 * Importador de fatura CSV da tela `/cartoes` (história #269): select de
 * cartão, input `.csv`, "Pré-visualizar" (dryRun) e "Substituir competência"
 * (confirmação). Sem requisição em voo os botões ficam desabilitados; após a
 * confirmação a página chama `router.refresh()` para a lista de compras
 * exibir os lançamentos importados sem reload manual.
 */
export default function InvoiceImportPanel({
  cards,
}: InvoiceImportPanelProps) {
  const router = useRouter();
  const [cardId, setCardId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState<InvoiceImportMode | null>(null);
  const [preview, setPreview] = useState<InvoiceImportPreviewSummary | null>(
    null,
  );
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const busyRef = useRef(false);

  function resetFeedback() {
    setPreview(null);
    setStatus(null);
    setError(null);
  }

  function handleCardChange(nextCardId: string) {
    setCardId(nextCardId);
    resetFeedback();
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    setFile(event.target.files?.[0] ?? null);
    resetFeedback();
  }

  async function run(mode: InvoiceImportMode) {
    if (busyRef.current || !cardId || !file) return;
    busyRef.current = true;
    setBusy(mode);
    setError(null);
    try {
      const outcome = await executeInvoiceImport({
        mode,
        cardId,
        file,
        onImported: () => router.refresh(),
      });
      if (outcome.error !== null) setError(outcome.error);
      if (outcome.preview !== null) {
        setPreview(outcome.preview);
        setStatus(null);
      }
      if (outcome.confirmation !== null) {
        setStatus(confirmationStatusText(outcome.confirmation));
        setPreview(null);
      }
    } finally {
      busyRef.current = false;
      setBusy(null);
    }
  }

  return (
    <InvoiceImportBody
      cards={cards}
      cardId={cardId}
      hasFile={file !== null}
      busy={busy}
      preview={preview}
      status={status}
      error={error}
      onCardChange={handleCardChange}
      onFileChange={handleFileChange}
      onPreview={() => void run("preview")}
      onConfirm={() => void run("confirm")}
    />
  );
}
