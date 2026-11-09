import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  MonthNavigationView,
  type MonthNavigationViewProps,
} from "./MonthNavigation";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

function render(overrides: Partial<MonthNavigationViewProps> = {}): string {
  const props: MonthNavigationViewProps = {
    monthKey: "2026-11",
    isCurrentMonth: false,
    isPending: false,
    onPrevious: () => {},
    onNext: () => {},
    onSelectMonth: () => {},
    children: createElement("div", null, "Pode gastar por dia"),
    ...overrides,
  };
  return renderToStaticMarkup(createElement(MonthNavigationView, props));
}

describe("MonthNavigationView (markup estático)", () => {
  it("mostra o conteúdo quando a navegação terminou", () => {
    const html = render({ isPending: false });

    expect(html).toContain("Pode gastar por dia");
    expect(html).not.toContain("Carregando…");
    expect(html).not.toContain('disabled=""');
  });

  it("troca o conteúdo pelo skeleton acessível enquanto está pendente", () => {
    const html = render({ isPending: true });

    expect(html).toContain("Carregando…");
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('aria-busy="true"');
    expect(html).not.toContain("Pode gastar por dia");
  });

  it("desabilita os controles do seletor enquanto está pendente", () => {
    const html = render({ isPending: true });

    const disabledCount = (html.match(/disabled=""/g) ?? []).length;
    // Dois botões + o input de mês.
    expect(disabledCount).toBeGreaterThanOrEqual(3);
  });

  it("exibe o mês da fatura e o intervalo da janela", () => {
    const html = render({
      monthKey: "2026-11",
      rangeLabel: "15/11 a 14/12",
    });

    expect(html).toContain("novembro de 2026");
    expect(html).toContain("15/11 a 14/12");
  });
});
