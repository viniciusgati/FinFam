"use client";

import { useState, type MouseEvent } from "react";
import {
  EXPORT_LOADING_LABEL,
  EXPORT_LOGIN_HREF,
  exportFeedback,
  type ExportDownloadStatus,
} from "@/lib/export-feedback";
import {
  EXPORT_TABLES,
  EXPORT_TABLE_NAMES,
  type ExportTableName,
} from "@/lib/export-data";

type ExportTarget = "json" | ExportTableName;

interface DownloadResult {
  status: ExportDownloadStatus;
  target: ExportTarget | null;
  filename: string | null;
}

const IDLE_RESULT: DownloadResult = {
  status: "idle",
  target: null,
  filename: null,
};

function exportHref(target: ExportTarget): string {
  return target === "json"
    ? "/api/export"
    : `/api/export?formato=csv&tabela=${target}`;
}

function fallbackFilename(target: ExportTarget): string {
  return target === "json"
    ? "finfam-dados.json"
    : `finfam-${target}.csv`;
}

/** Nome do arquivo lido de `Content-Disposition` (com ou sem aspas). */
function filenameFromDisposition(header: string | null): string | null {
  if (!header) return null;

  const encoded = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (encoded) {
    const value = encoded[1].trim();
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }

  const quoted = /filename="([^"]+)"/i.exec(header);
  if (quoted) return quoted[1].trim();

  const bare = /filename=([^;]+)/i.exec(header);
  return bare ? bare[1].trim() : null;
}

/** Dispara o download local do blob, sem enviar dados a terceiros. */
function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

const LINK_CLASS =
  "font-medium text-emerald-700 underline-offset-2 transition hover:underline aria-disabled:cursor-not-allowed aria-disabled:opacity-60";

/**
 * Bloco "Baixar meus dados" em `/configuracoes`.
 *
 * Client component apenas para o feedback por clique: cada link continua sendo
 * um `<a href="/api/export">` que baixa nativamente sem JS. Com JS ativo, o
 * clique é interceptado para mostrar "Preparando…", o sucesso/erro no próprio
 * card e para ler o nome do arquivo de `Content-Disposition`.
 */
export default function ExportDataCard() {
  const [result, setResult] = useState<DownloadResult>(IDLE_RESULT);
  const feedback = exportFeedback({
    status: result.status,
    filename: result.filename,
  });

  function isPending(target: ExportTarget): boolean {
    return result.status === "loading" && result.target === target;
  }

  function successMessageFor(target: ExportTarget): string | null {
    if (result.status !== "success" || result.target !== target) return null;
    return feedback.message;
  }

  async function handleDownload(target: ExportTarget): Promise<void> {
    if (isPending(target)) return;

    setResult({ status: "loading", target, filename: null });

    try {
      const response = await fetch(exportHref(target), {
        credentials: "same-origin",
      });

      if (!response.ok) {
        setResult({
          status: response.status === 401 ? "error401" : "error500",
          target,
          filename: null,
        });
        return;
      }

      const blob = await response.blob();
      const filename =
        filenameFromDisposition(response.headers.get("Content-Disposition")) ??
        fallbackFilename(target);

      downloadBlob(blob, filename);
      setResult({ status: "success", target, filename });
    } catch {
      setResult({ status: "error500", target, filename: null });
    }
  }

  function handleClick(target: ExportTarget) {
    return (event: MouseEvent<HTMLAnchorElement>) => {
      event.preventDefault();
      void handleDownload(target);
    };
  }

  function linkLabel(target: ExportTarget, label: string): string {
    return isPending(target) ? EXPORT_LOADING_LABEL : label;
  }

  return (
    <section className="space-y-4 rounded-2xl border border-border bg-surface p-6 text-left shadow-sm">
      <header className="space-y-1">
        <h2 className="text-lg font-semibold text-foreground">
          Baixar meus dados
        </h2>
        <p className="text-sm text-foreground-muted">
          O JSON contém todos os dados da família: receitas, despesas fixas e
          variáveis, cartões, compras, fechamentos, configurações e revisões.
          Cada CSV contém uma tabela, com os valores monetários em reais. Nada é
          enviado a terceiros: o arquivo é gerado e baixado localmente.
        </p>
      </header>

      <div className="space-y-2">
        <a
          href="/api/export"
          onClick={handleClick("json")}
          aria-disabled={isPending("json") ? "true" : undefined}
          className={LINK_CLASS}
        >
          {linkLabel("json", "Baixar tudo (JSON)")}
        </a>
        {successMessageFor("json") ? (
          <p role="status" className="text-sm text-emerald-700">
            {successMessageFor("json")}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-foreground">
          CSV por tabela
        </h3>
        <ul className="space-y-2">
          {EXPORT_TABLE_NAMES.map((name) => {
            const message = successMessageFor(name);
            return (
              <li key={name} className="space-y-1 text-sm">
                <a
                  href={exportHref(name)}
                  onClick={handleClick(name)}
                  aria-disabled={isPending(name) ? "true" : undefined}
                  className={LINK_CLASS}
                >
                  {linkLabel(name, EXPORT_TABLES[name].label)}
                </a>
                {message ? (
                  <p role="status" className="text-emerald-700">
                    {message}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>

      <p className="text-xs text-foreground-muted">{feedback.emptyNote}</p>

      {feedback.message && result.status !== "success" ? (
        <div role="alert" className="space-y-1 text-sm">
          <p className="text-red-600">{feedback.message}</p>
          {feedback.loginHref ? (
            <a href={EXPORT_LOGIN_HREF} className={LINK_CLASS}>
              Entrar novamente
            </a>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
