/**
 * Estado visual do bloco "Baixar meus dados" em `/configuracoes`.
 *
 * Função pura: recebe o status do download (e o nome do arquivo no sucesso) e
 * devolve exatamente os textos exibidos. O componente apenas renderiza; assim
 * os textos ficam testáveis sem DOM.
 */

export const EXPORT_LOADING_LABEL = "Preparando…";

export const EXPORT_EMPTY_NOTE =
  "Tabelas sem registros geram um arquivo apenas com o cabeçalho.";

export const EXPORT_ERROR_401_MESSAGE =
  "Sua sessão expirou. Entre novamente para baixar seus dados.";

export const EXPORT_ERROR_500_MESSAGE =
  "Não foi possível gerar a exportação. Tente novamente.";

export const EXPORT_LOGIN_HREF = "/login";

export function exportSuccessMessage(filename: string): string {
  return `Download iniciado: ${filename}`;
}

export type ExportDownloadStatus =
  | "idle"
  | "loading"
  | "success"
  | "error401"
  | "error500";

export interface ExportFeedbackState {
  status: ExportDownloadStatus;
  /** Nome lido de `Content-Disposition` (usado somente no sucesso). */
  filename?: string | null;
}

export interface ExportFeedback {
  /** Texto do link acionado; no carregamento vira "Preparando…". */
  actionLabel: string | null;
  /** Mensagem de feedback; `null` no estado inicial. */
  message: string | null;
  /** Link de login exibido apenas no 401. */
  loginHref: string | null;
  /** Link acionado desabilitado (`aria-disabled`) durante o carregamento. */
  disabled: boolean;
  /** Nota fixa sobre tabela sem registros. */
  emptyNote: string;
}

export function exportFeedback(state: ExportFeedbackState): ExportFeedback {
  const idle: ExportFeedback = {
    actionLabel: null,
    message: null,
    loginHref: null,
    disabled: false,
    emptyNote: EXPORT_EMPTY_NOTE,
  };

  switch (state.status) {
    case "loading":
      return {
        ...idle,
        actionLabel: EXPORT_LOADING_LABEL,
        message: null,
        disabled: true,
      };
    case "success":
      return {
        ...idle,
        actionLabel: null,
        message: exportSuccessMessage(state.filename ?? ""),
      };
    case "error401":
      return {
        ...idle,
        message: EXPORT_ERROR_401_MESSAGE,
        loginHref: EXPORT_LOGIN_HREF,
      };
    case "error500":
      return {
        ...idle,
        message: EXPORT_ERROR_500_MESSAGE,
        disabled: false,
      };
    case "idle":
    default:
      return idle;
  }
}
