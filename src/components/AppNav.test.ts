import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { NAV_ITEMS } from "@/lib/navigation";
import AppNav from "./AppNav";

vi.mock("next/navigation", () => ({
  usePathname: () => "/gastos",
}));

function render(props: { initialExpanded?: boolean } = {}): string {
  return renderToStaticMarkup(createElement(AppNav, props));
}

function linkSlice(html: string, href: string): string {
  const hrefIndex = html.indexOf(`href="${href}"`);
  expect(hrefIndex).toBeGreaterThanOrEqual(0);
  const start = html.lastIndexOf("<a", hrefIndex);
  const end = html.indexOf("</a>", hrefIndex);
  return html.slice(start, end + "</a>".length);
}

function buttonSlice(html: string, marker: string): string {
  const markerIndex = html.indexOf(marker);
  expect(markerIndex).toBeGreaterThanOrEqual(0);
  const start = html.lastIndexOf("<button", markerIndex);
  const end = html.indexOf(">", markerIndex) + 1;
  return html.slice(start, end);
}

describe("AppNav (markup estático)", () => {
  it("mantém a topbar mobile com hamburger, aria-expanded e aria-controls", () => {
    const html = render();

    expect(html).toContain("md:hidden");
    expect(html).toContain("☰");
    expect(html).toContain("Abrir menu");
    expect(html).toContain('aria-controls="app-menu"');
    expect(html).not.toContain('aria-pressed="true"');
  });

  it("menu expandido (padrão): md:w-64, ícone + rótulo visíveis nos 9 itens", () => {
    const html = render();

    expect(html).toContain("md:w-64");
    expect(html).toContain("md:sticky");
    expect(html).toContain("md:p-4");
    for (const item of NAV_ITEMS) {
      const link = linkSlice(html, item.href);
      expect(link).toContain(`title="${item.label}"`);
      expect(link).toContain(`>${item.label}</span>`);
      expect(link).not.toContain("md:sr-only");
    }
    expect((html.match(/<svg/g) ?? []).length).toBe(10); // 9 itens + colapsar
  });

  it("menu colapsado: md:w-16, rótulos só em md:sr-only com title, ícone visível", () => {
    const html = render({ initialExpanded: false });

    expect(html).toContain("md:w-16");
    expect(html).not.toContain("md:w-64");
    for (const item of NAV_ITEMS) {
      const link = linkSlice(html, item.href);
      expect(link).toContain(`title="${item.label}"`);
      expect(link).toContain(`md:sr-only">${item.label}</span>`);
      expect(link).toContain("<svg");
    }
    expect((html.match(/<svg/g) ?? []).length).toBe(10); // 9 itens + expandir
  });

  it("rota ativa mantém borda esmeralda, fundo e aria-current também colapsada", () => {
    const html = render({ initialExpanded: false });
    const active = linkSlice(html, "/gastos");

    expect(active).toContain('aria-current="page"');
    expect(active).toContain("border-emerald-500");
    expect(active).toContain("bg-emerald-500/15");
    expect(active).toContain('title="Gastos avulsos"');

    const inactive = linkSlice(html, "/");
    expect(inactive).not.toContain('aria-current="page"');
    expect(inactive).toContain('title="Dashboard"');
  });

  it("menu expandido: controle tem aria-expanded=true, aria-controls e nome Recolher menu", () => {
    const html = render({ initialExpanded: true });
    const button = buttonSlice(html, 'title="Recolher menu"');

    expect(button).toContain('aria-expanded="true"');
    expect(button).toContain('aria-controls="app-menu"');
    expect(button).toContain("Recolher menu");
    expect(html).toContain('<span class="sr-only">Recolher menu</span>');
    expect(html).not.toContain("Fixar menu");
    expect(html).not.toContain("Desfixar menu");
  });

  it("menu recolhido: controle tem aria-expanded=false, aria-controls e nome Expandir menu", () => {
    const html = render({ initialExpanded: false });
    const button = buttonSlice(html, 'title="Expandir menu"');

    expect(button).toContain('aria-expanded="false"');
    expect(button).toContain('aria-controls="app-menu"');
    expect(button).toContain("Expandir menu");
    expect(html).toContain('<span class="sr-only">Expandir menu</span>');
    expect(html).not.toContain("Fixar menu");
    expect(html).not.toContain("Desfixar menu");
  });

  it("fecha o menu mobile ao pressionar Escape (regressão #373)", () => {
    const source = readFileSync(
      new URL("./AppNav.tsx", import.meta.url),
      "utf8",
    );

    expect(source).toContain('event.key === "Escape"');
    expect(source).toContain('document.addEventListener("keydown"');
    expect(source).toContain("setOpen(false)");
  });
});
