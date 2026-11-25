import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import PeriodDiagnosisCard from "./PeriodDiagnosisCard";
import {
  PERIOD_ANALYSIS_EMPTY_MESSAGE,
  PERIOD_ANALYSIS_TITLE,
  type PeriodAnalysisView,
} from "@/lib/period-analysis-view";

function makeView(
  overrides: Partial<PeriodAnalysisView> = {},
): PeriodAnalysisView {
  return {
    title: PERIOD_ANALYSIS_TITLE,
    confidenceLabel: "Base parcial",
    confidenceTone: "warning",
    summaryLabel: "Sobra média de R$ 200,00 nos últimos 4 meses fechados.",
    paceLabel: "No dia 10, o consumo variável foi R$ 300,00.",
    commitmentLabel: "Contas fixas: R$ 600,00 (60% da renda média).",
    categoryMovers: [
      { category: "Mercado", detail: "acima da média em R$ 100,00 (+33.3%)" },
    ],
    anomalies: [
      {
        id: "category-spike-mercado",
        title: "Categoria acima da base",
        detail: "Mercado está R$ 100,00 acima da média.",
        severity: "warning",
      },
    ],
    levers: [
      {
        id: "frequency-ifood",
        label: "Reduzir frequência",
        detail: "iFood: cortar 1 por mês libera R$ 55,00/mês.",
      },
    ],
    totalSavingsLabel: "Cortes sugeridos: R$ 55,00/mês.",
    dataQualityLabel: "Base parcial · 10% sem categoria",
    isEmpty: false,
    emptyMessage: PERIOD_ANALYSIS_EMPTY_MESSAGE,
    ...overrides,
  };
}

describe("PeriodDiagnosisCard", () => {
  it("renderiza resumo, variações, alertas, cortes e qualidade", () => {
    const html = renderToStaticMarkup(
      createElement(PeriodDiagnosisCard, {
        view: makeView(),
        monthKey: "2026-05",
      }),
    );

    expect(html).toContain(`aria-label="${PERIOD_ANALYSIS_TITLE}"`);
    expect(html).toContain(PERIOD_ANALYSIS_TITLE);
    expect(html).toContain("Base parcial");
    expect(html).toContain("Sobra média de R$ 200,00");
    expect(html).toContain("No dia 10");
    expect(html).toContain("Contas fixas: R$ 600,00");
    expect(html).toContain("Maiores variações");
    expect(html).toContain("Mercado");
    expect(html).toContain("acima da média em R$ 100,00");
    expect(html).toContain("Pontos de atenção");
    expect(html).toContain("Categoria acima da base");
    expect(html).toContain("Onde dá para cortar");
    expect(html).toContain("Reduzir frequência");
    expect(html).toContain("Cortes sugeridos: R$ 55,00/mês.");
    expect(html).toContain("Leitura da IA");
    expect(html).toContain("Gerar análise com IA");
    expect(html).toContain("Base parcial · 10% sem categoria");
  });

  it("omite seções opcionais quando não há dados", () => {
    const html = renderToStaticMarkup(
      createElement(PeriodDiagnosisCard, {
        view: makeView({
          paceLabel: null,
          commitmentLabel: null,
          categoryMovers: [],
          anomalies: [],
          levers: [],
          totalSavingsLabel: null,
          dataQualityLabel: null,
        }),
        monthKey: "2026-05",
      }),
    );

    expect(html).not.toContain("Maiores variações");
    expect(html).not.toContain("Pontos de atenção");
    expect(html).not.toContain("Onde dá para cortar");
    expect(html).not.toContain("No dia 10");
    expect(html).not.toContain("Contas fixas");
  });

  it("renderiza o estado vazio com a mensagem exata", () => {
    const html = renderToStaticMarkup(
      createElement(PeriodDiagnosisCard, {
        view: makeView({
          isEmpty: true,
          summaryLabel: "Ainda não há meses fechados para comparar.",
          dataQualityLabel: null,
        }),
        monthKey: "2026-05",
      }),
    );

    expect(html).toContain(PERIOD_ANALYSIS_EMPTY_MESSAGE);
    expect(html).not.toContain("Maiores variações");
    expect(html).not.toContain("Onde dá para cortar");
    expect(html).not.toContain("Leitura da IA");
  });
});
