import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
import {
  HISTORY_CHART_EMPTY_MESSAGE,
  HISTORY_CHART_SINGLE_MONTH_MESSAGE,
  HISTORY_EMPTY_MESSAGE,
  HISTORY_ERROR_MESSAGE,
  HISTORY_LOADING_MESSAGE,
  HISTORY_NO_CATEGORY_MESSAGE,
  HISTORY_RETRY_PENDING_LABEL,
  historyView,
  type MonthHistorySnapshot,
} from "@/lib/history";
import HistoryView from "./HistoryView";

function render(view: Parameters<typeof HistoryView>[0]["view"]): string {
  return renderToStaticMarkup(createElement(HistoryView, { view })).replace(
    /\u00a0/g,
    " ",
  );
}

function snapshot(
  overrides: Partial<MonthHistorySnapshot> & { monthKey: string },
): MonthHistorySnapshot {
  return {
    incomeCents: 200000,
    consumedCents: 0,
    consumedPercent: 0,
    fixedExpensesCents: 0,
    consumptionAvailableCents: 0,
    dailyAverageCents: 0,
    categories: [],
    ...overrides,
  };
}

const august = snapshot({
  monthKey: "2026-08",
  consumedCents: 90000,
  consumedPercent: 45,
  consumptionAvailableCents: 120000,
  dailyAverageCents: 3871,
  categories: [
    { category: "Moradia", amountCents: 80000 },
    { category: "Mercado", amountCents: 10000 },
  ],
});

const september = snapshot({
  monthKey: "2026-09",
  consumedCents: 120000,
  consumedPercent: 60,
  consumptionAvailableCents: 100000,
  dailyAverageCents: 3333,
  categories: [
    { category: "Moradia", amountCents: 100000 },
    { category: "Casa", amountCents: 20000 },
  ],
});

function okView(snapshots: MonthHistorySnapshot[]) {
  return historyView({
    dbError: false,
    isFutureMonth: false,
    referenceMonthKey: "2026-10",
    snapshots,
  });
}

describe("HistoryView — estado ok (markup estático)", () => {
  it("mostra o mês selecionado e as colunas consumo/média/%/total por mês", () => {
    const html = render(okView([august, september]));

    expect(html).toContain("outubro de 2026");
    expect(html).toContain("Consumo");
    expect(html).toContain("Média diária");
    expect(html).toContain("%");
    expect(html).toContain("Total");

    // Agosto: consumo R$ 1.200,00, média R$ 38,71, 45%, total R$ 900,00.
    expect(html).toContain("R$ 1.200,00");
    expect(html).toContain("R$ 38,71");
    expect(html).toContain("45%");
    expect(html).toContain("R$ 900,00");
    // Setembro: consumo R$ 1.000,00, média R$ 33,33, 60%, total R$ 1.200,00.
    expect(html).toContain("R$ 1.000,00");
    expect(html).toContain("R$ 33,33");
    expect(html).toContain("60%");
    expect(html).toContain("R$ 1.200,00");
  });

  it("renderiza o gráfico com role=img e aria-label em pt-BR", () => {
    const html = render(okView([august, september]));

    expect(html).toContain('role="img"');
    expect(html).toContain("agosto de 2026 R$ 900,00");
    expect(html).toContain("setembro de 2026 R$ 1.200,00");
  });

  it("mostra o comparativo por categoria com delta e flag de variação", () => {
    const html = render(okView([august, september]));

    expect(html).toContain("Comparativo por categoria");
    expect(html).toContain("Moradia");
    expect(html).toContain("+R$ 200,00");
    expect(html).toContain("maior");
    // Mercado existe só em agosto: ausente em setembro e delta negativo.
    expect(html).toContain("—");
    expect(html).toContain("-R$ 100,00");
    expect(html).toContain("menor");
  });

  it("avisa a tendência com apenas 1 mês, mantendo a barra", () => {
    const html = render(okView([august]));

    expect(html).toContain(HISTORY_CHART_SINGLE_MONTH_MESSAGE);
    expect(html).toContain('role="img"');
    expect(html).toContain("agosto de 2026 R$ 900,00");
  });

  it("exibe o vazio do gráfico quando todos os meses estão zerados", () => {
    const zeroed = snapshot({ monthKey: "2026-09", consumedCents: 0 });
    const html = render(okView([zeroed]));

    expect(html).toContain(HISTORY_CHART_EMPTY_MESSAGE);
    expect(html).not.toContain("NaN");
    expect(html).not.toContain('role="img"');
  });

  it("exibe o vazio do comparativo sem categorias na janela", () => {
    const html = render(okView([snapshot({ monthKey: "2026-09" })]));

    expect(html).toContain(HISTORY_NO_CATEGORY_MESSAGE);
  });

  it("mostra a seção de ajuda à família com mensagem acionável", () => {
    const html = render(okView([august, september]));

    expect(html).toContain("Ajuda à família");
    expect(html).toContain("acima da média dos últimos 1 meses");
  });
});

describe("HistoryView — estados vazio e erro", () => {
  it("renderiza o alerta de erro com retry acessível", () => {
    const html = render(
      historyView({
        dbError: true,
        isFutureMonth: false,
        referenceMonthKey: "2026-10",
        snapshots: [],
      }),
    );

    expect(html).toContain('role="alert"');
    expect(html).toContain(HISTORY_ERROR_MESSAGE);
    expect(html).toContain("Tentar novamente");
  });

  it("renderiza o vazio próprio (distinto do dashboard) com CTA", () => {
    const html = render(okView([]));

    expect(html).toContain(HISTORY_EMPTY_MESSAGE);
    expect(html).toContain('href="/gastos"');
    expect(html).toContain("Registrar gastos");
  });

  it("mantém os textos de ok/vazio/erro/sem-categoria/loading distintos", () => {
    const texts = new Set([
      HISTORY_LOADING_MESSAGE,
      HISTORY_EMPTY_MESSAGE,
      HISTORY_ERROR_MESSAGE,
      HISTORY_NO_CATEGORY_MESSAGE,
      HISTORY_CHART_SINGLE_MONTH_MESSAGE,
      HISTORY_CHART_EMPTY_MESSAGE,
      HISTORY_RETRY_PENDING_LABEL,
    ]);
    expect(texts.size).toBe(7);
  });
});
