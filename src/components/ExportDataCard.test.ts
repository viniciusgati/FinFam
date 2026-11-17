import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EXPORT_TABLES, EXPORT_TABLE_NAMES } from "@/lib/export-data";
import { EXPORT_EMPTY_NOTE } from "@/lib/export-feedback";
import ExportDataCard from "./ExportDataCard";

function render(): string {
  return renderToStaticMarkup(createElement(ExportDataCard)).replace(
    /\u00a0/g,
    " ",
  );
}

describe("ExportDataCard (estado inicial)", () => {
  it("mostra título, texto sobre JSON/CSV e o download completo", () => {
    const html = render();

    expect(html).toContain("Baixar meus dados");
    expect(html).toContain("JSON");
    expect(html).toContain("CSV");
    expect(html).toContain('href="/api/export"');
    expect(html).toContain("Baixar tudo (JSON)");
    expect(html).toContain("gerado e baixado localmente");
  });

  it("mostra a nota fixa de tabela sem registros", () => {
    const html = render();

    expect(html).toContain(
      "Tabelas sem registros geram um arquivo apenas com o cabeçalho.",
    );
    expect(html).toContain(EXPORT_EMPTY_NOTE);
  });

  it("lista as 10 tabelas com o href CSV e o rótulo pt-BR", () => {
    const html = render().replace(/&amp;/g, "&");

    expect(EXPORT_TABLE_NAMES).toHaveLength(10);

    for (const name of EXPORT_TABLE_NAMES) {
      expect(html).toContain(`href="/api/export?formato=csv&tabela=${name}"`);
      expect(html).toContain(EXPORT_TABLES[name].label);
    }

    expect(html).toContain(">Receitas<");
    expect(html).toContain(">Receitas variáveis<");
    expect(html).toContain(">Despesas fixas<");
    expect(html).toContain(">Cartões de crédito<");
    expect(html).toContain(">Despesas variáveis<");
    expect(html).toContain(">Compras no cartão<");
    expect(html).toContain(">Fechamentos mensais<");
    expect(html).toContain(">Fechamentos por categoria<");
    expect(html).toContain(">Configurações do app<");
    expect(html).toContain(">Revisões mensais<");
  });

  it("começa sem carregamento, sem download iniciado e com links habilitados", () => {
    const html = render();

    expect(html).not.toContain("Preparando…");
    expect(html).not.toContain("Download iniciado");
    expect(html).not.toContain('aria-disabled="true"');
  });
});

describe("ExportDataCard (wiring do download)", () => {
  it("intercepta o clique e busca com credenciais same-origin", () => {
    const source = readFileSync(
      fileURLToPath(new URL("./ExportDataCard.tsx", import.meta.url)),
      "utf8",
    );

    expect(source).toContain("event.preventDefault()");
    expect(source).toContain('credentials: "same-origin"');
    expect(source).toContain('response.headers.get("Content-Disposition")');
    expect(source).toContain("URL.createObjectURL");
  });
});
