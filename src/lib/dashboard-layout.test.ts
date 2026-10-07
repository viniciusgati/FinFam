import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Guarda o layout do dashboard descrito na história #232: largura total (sem
 * `max-w-4xl`/`mx-auto`) e card de status lado a lado com o lançamento rápido
 * em viewports `md+` (tablet/desktop), empilhados abaixo disso.
 */

function readSource(relativePath: string): string {
  return readFileSync(
    fileURLToPath(new URL(relativePath, import.meta.url)),
    "utf8",
  );
}

describe("layout do dashboard", () => {
  it("usa largura total, sem max-w nem mx-auto no container", () => {
    const page = readSource("../app/(app)/page.tsx");

    expect(page).toContain('className="flex w-full flex-col gap-6"');
    expect(page).not.toMatch(/max-w-4xl/);
    expect(page).not.toMatch(/mx-auto flex w-full/);
  });

  it("coloca status e lançamento rápido no mesmo grid responsivo", () => {
    const page = readSource("../app/(app)/page.tsx");

    expect(page).toContain("md:grid-cols-3");
    expect(page).toContain('isCalendarMonth ? "md:col-span-1" : "md:col-span-3"');
    expect(page).toContain('className="md:col-span-2"');
  });
});

describe("QuickExpenseCard em colunas estreitas", () => {
  it("empilha os campos antes de lg", () => {
    const card = readSource("../components/QuickExpenseCard.tsx");

    expect(card).toContain('className="grid gap-4 lg:grid-cols-3"');
    expect(card).not.toContain('className="grid gap-4 sm:grid-cols-3"');
  });
});
