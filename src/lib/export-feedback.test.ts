import { describe, expect, it } from "vitest";
import {
  EXPORT_EMPTY_NOTE,
  EXPORT_ERROR_401_MESSAGE,
  EXPORT_ERROR_500_MESSAGE,
  EXPORT_LOADING_LABEL,
  EXPORT_LOGIN_HREF,
  exportFeedback,
  exportSuccessMessage,
} from "./export-feedback";

describe("exportFeedback", () => {
  it("no estado inicial não exibe mensagem nem link de login", () => {
    const feedback = exportFeedback({ status: "idle" });

    expect(feedback.actionLabel).toBeNull();
    expect(feedback.message).toBeNull();
    expect(feedback.loginHref).toBeNull();
    expect(feedback.disabled).toBe(false);
  });

  it("no carregamento mostra o rótulo e desabilita o link acionado", () => {
    const feedback = exportFeedback({ status: "loading" });

    expect(feedback.actionLabel).toBe("Preparando…");
    expect(feedback.actionLabel).toBe(EXPORT_LOADING_LABEL);
    expect(feedback.disabled).toBe(true);
    expect(feedback.message).toBeNull();
  });

  it("no sucesso mostra o nome do arquivo até o próximo clique", () => {
    const feedback = exportFeedback({
      status: "success",
      filename: "finfam-dados-2026-11-17.json",
    });

    expect(feedback.message).toBe(
      "Download iniciado: finfam-dados-2026-11-17.json",
    );
    expect(feedback.message).toBe(
      exportSuccessMessage("finfam-dados-2026-11-17.json"),
    );
    expect(feedback.disabled).toBe(false);
    expect(feedback.loginHref).toBeNull();
  });

  it("no 401 orienta entrar novamente com link para /login", () => {
    const feedback = exportFeedback({ status: "error401" });

    expect(feedback.message).toBe(
      "Sua sessão expirou. Entre novamente para baixar seus dados.",
    );
    expect(feedback.message).toBe(EXPORT_ERROR_401_MESSAGE);
    expect(feedback.loginHref).toBe("/login");
    expect(feedback.loginHref).toBe(EXPORT_LOGIN_HREF);
  });

  it("no 500 ou falha de rede reabilita o link para nova tentativa", () => {
    const feedback = exportFeedback({ status: "error500" });

    expect(feedback.message).toBe(
      "Não foi possível gerar a exportação. Tente novamente.",
    );
    expect(feedback.message).toBe(EXPORT_ERROR_500_MESSAGE);
    expect(feedback.disabled).toBe(false);
    expect(feedback.loginHref).toBeNull();
  });

  it("só o estado 401 oferece o link de login", () => {
    const statuses = [
      "idle",
      "loading",
      "success",
      "error401",
      "error500",
    ] as const;

    for (const status of statuses) {
      const feedback = exportFeedback({ status, filename: "arquivo.json" });
      if (status === "error401") {
        expect(feedback.loginHref).toBe("/login");
      } else {
        expect(feedback.loginHref).toBeNull();
      }
    }
  });

  it("sempre informa a nota fixa de tabela sem registros", () => {
    const statuses = [
      "idle",
      "loading",
      "success",
      "error401",
      "error500",
    ] as const;

    for (const status of statuses) {
      expect(exportFeedback({ status }).emptyNote).toBe(
        "Tabelas sem registros geram um arquivo apenas com o cabeçalho.",
      );
    }

    expect(EXPORT_EMPTY_NOTE).toBe(
      "Tabelas sem registros geram um arquivo apenas com o cabeçalho.",
    );
  });
});
