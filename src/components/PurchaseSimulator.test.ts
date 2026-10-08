import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Verificação de fonte do simulador (o projeto não possui test runner de DOM):
 * sinaliza a origem do veredito e mantém os feedbacks de carregando, validação
 * e falha.
 */

function readSource(relativePath: string): string {
  return readFileSync(
    fileURLToPath(new URL(relativePath, import.meta.url)),
    "utf8",
  );
}

describe("PurchaseSimulator", () => {
  it("propaga source e avisa quando o veredito é local", () => {
    const source = readSource("./PurchaseSimulator.tsx");

    expect(source).toContain('source: "ai" | "local"');
    expect(source).toContain('result.source === "local"');
    expect(source).toContain("Resultado calculado localmente, sem IA.");
    expect(source).toContain('role="status"');
    expect(source).toContain('aria-live="polite"');
  });

  it("mantém os feedbacks de simulação", () => {
    const source = readSource("./PurchaseSimulator.tsx");

    expect(source).toContain("Consultando…");
    expect(source).toContain("Simular");
    expect(source).toContain("Informe um valor maior que zero");
    expect(source).toContain("Não foi possível simular agora. Tente novamente.");
    expect(source).toContain('role="alert"');
    expect(source).toContain('disabled={invalid || status === "loading"}');
  });
});
