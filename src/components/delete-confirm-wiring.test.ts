import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Guarda a confirmação de exclusão (história #260): `handleDelete` nos dois
 * managers precisa chamar `window.confirm(deleteConfirmMessage(...))` antes de
 * `setDeletingId`/`fetch`, de modo que cancelar não dispare requisição nem
 * mude estado. Verificação por leitura da fonte (os managers são client
 * components sem test runner de DOM).
 */

function readSource(relativePath: string): string {
  return readFileSync(
    fileURLToPath(new URL(relativePath, import.meta.url)),
    "utf8",
  );
}

function handleDeleteBody(source: string): string {
  const start = source.indexOf("async function handleDelete(");
  expect(start).toBeGreaterThanOrEqual(0);
  return source.slice(start, source.indexOf("\n  }\n", start));
}

const CASES = [
  {
    path: "./GastosManager.tsx",
    confirmCall:
      "window.confirm(deleteConfirmMessage(expense.description))",
  },
  {
    path: "./ExtraIncomesManager.tsx",
    confirmCall: "window.confirm(deleteConfirmMessage(income.description))",
  },
] as const;

describe("confirmação de exclusão nos managers", () => {
  for (const { path, confirmCall } of CASES) {
    it(`${path}: confirma antes de setDeletingId e fetch`, () => {
      const body = handleDeleteBody(readSource(path));

      const confirmIndex = body.indexOf(confirmCall);
      expect(confirmIndex).toBeGreaterThanOrEqual(0);

      expect(body.indexOf("setDeletingId")).toBeGreaterThan(confirmIndex);
      expect(body.indexOf("fetch(")).toBeGreaterThan(confirmIndex);
      expect(body).toContain("if (!window.confirm(");
      expect(body).toContain("return;");
    });
  }
});
