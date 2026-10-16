import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import MonthSelector, {
  MonthSelectorView,
  type MonthSelectorViewProps,
} from "./MonthSelector";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

function render(overrides: Partial<MonthSelectorViewProps> = {}): string {
  const props: MonthSelectorViewProps = {
    monthKey: "2026-09",
    isCurrentMonth: false,
    isPending: false,
    onPrevious: () => {},
    onNext: () => {},
    onSelectMonth: () => {},
    ...overrides,
  };
  return renderToStaticMarkup(createElement(MonthSelectorView, props));
}

describe("MonthSelectorView (markup estático)", () => {
  it("exibe o mês selecionado e permite navegar quando não está pendente", () => {
    const html = render({ monthKey: "2026-09" });

    expect(html).toContain("setembro de 2026");
    expect(html).toContain("Mês anterior");
    expect(html).toContain("Próximo mês");
    expect(html).toContain('type="month"');
    expect(html).toContain('value="2026-09"');
    expect(html).not.toContain('disabled=""');
  });

  it("desabilita botões e input durante a transição (isPending)", () => {
    const html = render({ isPending: true });

    const disabledCount = (html.match(/disabled=""/g) ?? []).length;
    // Dois botões + o input de mês.
    expect(disabledCount).toBeGreaterThanOrEqual(3);
  });

  it("desabilita o próximo mês no mês corrente mesmo sem transição", () => {
    const html = render({ isCurrentMonth: true });
    expect(html).toContain('disabled=""');
  });

  it("mostra o intervalo da janela quando informado (moldura do ciclo)", () => {
    const html = render({ monthKey: "2026-09", rangeLabel: "15/09 a 14/10" });

    expect(html).toContain("setembro de 2026");
    expect(html).toContain("15/09 a 14/10");
  });

  it("sem intervalo não renderiza a linha extra", () => {
    const html = render({ monthKey: "2026-09" });
    expect(html).not.toContain("15/09 a 14/10");
  });
});

describe("MonthSelector do ciclo — mês exibido = mês da fatura", () => {
  it("com queryMonthShift 1, a chave ?mes=2026-10 aparece como novembro", () => {
    const html = renderToStaticMarkup(
      createElement(MonthSelector, {
        monthKey: "2026-10",
        isCurrentMonth: false,
        queryMonthShift: 1,
      }),
    );

    expect(html).toContain("novembro de 2026");
    expect(html).toContain('value="2026-11"');
  });

  it("sem shift, mantém a chave como mês exibido", () => {
    const html = renderToStaticMarkup(
      createElement(MonthSelector, {
        monthKey: "2026-09",
        isCurrentMonth: false,
      }),
    );

    expect(html).toContain("setembro de 2026");
    expect(html).toContain('value="2026-09"');
  });
});
