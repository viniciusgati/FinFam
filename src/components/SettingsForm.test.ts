import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import SettingsForm, { type SettingsFormProps } from "./SettingsForm";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

/**
 * Verificação de fonte do formulário de configurações (o projeto não possui
 * test runner de DOM): garante o texto de ajuda do ciclo, os feedbacks de
 * salvar (carregando, sucesso e erro) e o modo somente leitura quando a
 * configuração não pôde ser carregada.
 */

function readSource(relativePath: string): string {
  return readFileSync(
    fileURLToPath(new URL(relativePath, import.meta.url)),
    "utf8",
  );
}

function renderForm(overrides: Partial<SettingsFormProps> = {}): string {
  const props: SettingsFormProps = {
    initialCycleStartDay: 10,
    initialSavingsGoalCents: 100000,
    cycleWindowDays: 30,
    loadError: null,
    ...overrides,
  };
  return renderToStaticMarkup(createElement(SettingsForm, props)).replace(
    /\u00a0/g,
    " ",
  );
}

function disabledInputCount(html: string): number {
  const inputs = html.match(/<input[^>]*>/g) ?? [];
  return inputs.filter((tag) => tag.includes('disabled=""')).length;
}

function submitButtonTag(html: string): string {
  return html.match(/<button[^>]*type="submit"[^>]*>/)?.[0] ?? "";
}

function handleSubmitBody(source: string): string {
  const start = source.indexOf("async function handleSubmit(");
  expect(start).toBeGreaterThanOrEqual(0);
  return source.slice(start, source.indexOf("\n  }\n", start));
}

const HELP =
  "O dia de início do ciclo financeiro define quando seu ciclo começa. A janela do card de diária vai do início do ciclo até hoje; já o percentual consumido usa o mês calendário (do dia 1 ao último dia do mês).";

const LOAD_ERROR = "Não foi possível carregar a configuração. Tente novamente.";

describe("SettingsForm", () => {
  it("explica a origem do dia de início do ciclo e as duas janelas", () => {
    const source = readSource("./SettingsForm.tsx");

    expect(source).toContain(HELP);
    expect(source).toContain("ciclo");
    expect(source).toContain("diária");
    expect(source).toContain("percentual");
  });

  it("mantém o feedback de salvar: carregando, sucesso e erro acessíveis", () => {
    const source = readSource("./SettingsForm.tsx");

    expect(source).toContain("Salvando…");
    expect(source).toContain("Configuração salva com sucesso");
    expect(source).toContain('role="status"');
    expect(source).toContain('role="alert"');
    expect(source).toContain("Não foi possível salvar. Tente novamente.");
    expect(source).toContain("disabled={saving || readOnly}");
  });

  it("linka a explicação do ciclo ao glossário", () => {
    const source = readSource("./SettingsForm.tsx");

    expect(source).toContain("TermHelpLink");
    expect(source).toContain('termId="ciclo"');
  });

  it("oferece o campo opcional de meta e envia centavos (vazio vira null)", () => {
    const source = readSource("./SettingsForm.tsx");

    expect(source).toContain("Meta de economia por ciclo");
    expect(source).toContain("savingsGoalInputToCents");
    expect(source).toContain("savingsGoalPreview");
    expect(source).toContain("cycleWindowDays");
    expect(source).toContain("savingsGoalCents");
    expect(source).toContain("disabled={saving || readOnly}");
  });
});

describe("SettingsForm — erro de leitura (somente leitura)", () => {
  it("desabilita os dois inputs e o botão Salvar e oferece Tentar novamente", () => {
    const html = renderForm({ loadError: LOAD_ERROR });

    expect(html).toContain('role="alert"');
    expect(html).toContain(LOAD_ERROR);
    expect(html).toContain("Tentar novamente");
    expect(disabledInputCount(html)).toBe(2);
    expect(submitButtonTag(html)).toContain('disabled=""');
    expect(html).toContain(">Salvar<");
    // A prévia usa a janela do ciclo calculada com o default: não exibe.
    expect(html).not.toContain("Sua meta equivale a");
  });

  it("sem erro de leitura o formulário segue editável e salva normalmente", () => {
    const html = renderForm({ loadError: null });

    expect(html).not.toContain("Tentar novamente");
    expect(html).not.toContain('role="alert"');
    expect(disabledInputCount(html)).toBe(0);
    expect(submitButtonTag(html)).not.toContain('disabled=""');
    expect(html).toContain(">Salvar<");
    expect(html).toContain("Sua meta equivale a");
  });

  it("trava handleSubmit no modo somente leitura antes de qualquer fetch", () => {
    const body = handleSubmitBody(readSource("./SettingsForm.tsx"));

    const guard = body.indexOf("if (readOnly) return;");
    expect(guard).toBeGreaterThanOrEqual(0);
    expect(body.indexOf("fetch(")).toBeGreaterThan(guard);
  });
});
