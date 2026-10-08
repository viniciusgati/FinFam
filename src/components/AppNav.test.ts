import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { NAV_ITEMS } from "@/lib/navigation";
import AppNav from "./AppNav";

vi.mock("next/navigation", () => ({
  usePathname: () => "/gastos",
}));

function render(props: {
  initialExpanded?: boolean;
  initialPinned?: boolean;
} = {}): string {
  return renderToStaticMarkup(createElement(AppNav, props));
}

function linkSlice(html: string, href: string): string {
  const hrefIndex = html.indexOf(`href="${href}"`);
  expect(hrefIndex).toBeGreaterThanOrEqual(0);
  const start = html.lastIndexOf("<a", hrefIndex);
  const end = html.indexOf("</a>", hrefIndex);
  return html.slice(start, end + "</a>".length);
}

describe("AppNav (markup estático)", () => {
  it("mantém a topbar mobile com hamburger, aria-expanded e aria-controls", () => {
    const html = render();

    expect(html).toContain("md:hidden");
    expect(html).toContain("☰");
    expect(html).toContain("Abrir menu");
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('aria-controls="app-menu"');
    expect(html).not.toContain('aria-pressed="true"');
  });

  it("menu expandido (padrão): md:w-64, ícone + rótulo visíveis nos 7 itens", () => {
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
    expect((html.match(/<svg/g) ?? []).length).toBe(8); // 7 itens + fixar
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
    expect((html.match(/<svg/g) ?? []).length).toBe(8); // 7 itens + fixar
  });

  it("rota ativa mantém borda esmeralda, fundo e aria-current também colapsada", () => {
    const html = render({ initialExpanded: false });
    const active = linkSlice(html, "/gastos");

    expect(active).toContain('aria-current="page"');
    expect(active).toContain("border-emerald-500");
    expect(active).toContain("bg-emerald-500/15");
    expect(active).toContain('title="Gastos"');

    const inactive = linkSlice(html, "/");
    expect(inactive).not.toContain('aria-current="page"');
    expect(inactive).toContain('title="Dashboard"');
  });

  it("botão de fixar sem fixar: aria-pressed=false e estilo normal", () => {
    const html = render({ initialPinned: false });
    const start = html.indexOf('aria-pressed="false"');
    expect(start).toBeGreaterThanOrEqual(0);
    const pinButton = html.slice(
      html.lastIndexOf("<button", start),
      html.indexOf(">", start) + 1,
    );

    expect(pinButton).toContain('title="Fixar menu"');
    expect(pinButton).not.toContain("aria-expanded"); // aria-expanded é só do hamburger
    expect(html).not.toContain("bg-emerald-600");
  });

  it("botão de fixar fixado: aria-pressed=true, estilo destacado e rótulo Desfixar menu", () => {
    const html = render({ initialPinned: true });
    const start = html.indexOf('aria-pressed="true"');
    expect(start).toBeGreaterThanOrEqual(0);
    const pinButton = html.slice(
      html.lastIndexOf("<button", start),
      html.indexOf(">", start) + 1,
    );

    expect(pinButton).toContain('title="Desfixar menu"');
    expect(pinButton).toContain("bg-emerald-600");
    expect(pinButton).not.toContain("aria-expanded");
    expect(html.includes('title="Fixar menu"')).toBe(false);
  });
});
