import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Verificação de fonte (o projeto não possui test runner de DOM para server
 * components): o aviso de mês futuro é um componente próprio e não deve
 * sugerir cadastro de entradas — a ação cabe ao estado "sem renda".
 */

function readSource(relativePath: string): string {
  return readFileSync(
    fileURLToPath(new URL(relativePath, import.meta.url)),
    "utf8",
  );
}

describe("FutureMonthNotice", () => {
  it("explica que o mês futuro ainda não começou", () => {
    const source = readSource("./FutureMonthNotice.tsx");

    expect(source).toContain("Mês futuro");
    expect(source).toContain(
      "Este mês ainda não começou. Os dados aparecem quando ele chegar.",
    );
  });

  it("não sugere cadastro de entradas", () => {
    const source = readSource("./FutureMonthNotice.tsx");

    expect(source).not.toContain("Cadastre suas entradas");
    expect(source).not.toContain("/entradas");
  });
});
