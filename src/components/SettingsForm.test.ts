import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Verificação de fonte do formulário de configurações (o projeto não possui
 * test runner de DOM): garante o texto de ajuda do ciclo e os feedbacks de
 * salvar (carregando, sucesso e erro) exibidos ao usuário.
 */

function readSource(relativePath: string): string {
  return readFileSync(
    fileURLToPath(new URL(relativePath, import.meta.url)),
    "utf8",
  );
}

const HELP =
  "O dia de início do ciclo financeiro define quando seu ciclo começa. A janela do card de diária vai do início do ciclo até hoje; já o percentual consumido usa o mês calendário (do dia 1 ao último dia do mês).";

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
    expect(source).toContain("disabled={saving}");
  });
});
