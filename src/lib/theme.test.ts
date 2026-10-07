import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Guarda o tema dark fixo do FinFam: a paleta é declarada como tokens do
 * Tailwind v4 em `globals.css` (`color-scheme: dark`) e aplicada no elemento
 * `<html>` em `layout.tsx`. Se o tema claro voltar, estes testes quebram.
 */

function readAppFile(relativePath: string): string {
  return readFileSync(
    fileURLToPath(new URL(relativePath, import.meta.url)),
    "utf8",
  );
}

describe("tema dark padrão", () => {
  it("globals.css expõe color-scheme: dark e os tokens de tema", () => {
    const css = readAppFile("../app/globals.css");

    expect(css).toMatch(/color-scheme:\s*dark/);

    for (const token of [
      "--color-canvas",
      "--color-surface",
      "--color-surface-raised",
      "--color-border",
      "--color-foreground",
    ]) {
      expect(css).toContain(token);
    }
  });

  it("layout.tsx aplica o tema no <html> e themeColor escuro", () => {
    const layout = readAppFile("../app/layout.tsx");

    expect(layout).toMatch(/<html[^>]*className="dark"/);
    expect(layout).toContain('colorScheme: "dark"');
    expect(layout).toMatch(/themeColor:\s*"#[0-9a-fA-F]{6}"/);
    expect(layout).not.toContain('themeColor: "#16a34a"');
  });
});
