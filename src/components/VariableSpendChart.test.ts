import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import VariableSpendChart, {
  variableSpendChartAriaLabel,
  variableSpendEmptyLabel,
  variableSpendUnavailableLabel,
} from "./VariableSpendChart";
import { formatCents } from "@/lib/money";

const normal = (overrides: Partial<Parameters<typeof VariableSpendChart>[0]> = {}) =>
  renderToStaticMarkup(
    createElement(VariableSpendChart, {
      variableDailyExpensesCents: [
        0, 0, 0, 0, 5000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        3000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      ],
      averageCents: 6774,
      obligationsCents: 170000,
      elapsedDay: 15,
      ...overrides,
    }),
  );

/** Alturas de todos os `<rect>` de barra presentes no markup. */
function barHeights(html: string): number[] {
  return [...html.matchAll(/<rect[^>]*\bheight="([^"]*)"/g)].map((match) =>
    Number(match[1]),
  );
}

describe("rótulos puros de VariableSpendChart", () => {
  it("rotula exatamente o estado vazio e o indisponível", () => {
    expect(variableSpendEmptyLabel()).toBe(
      "Ainda sem gastos variáveis neste mês",
    );
    expect(variableSpendUnavailableLabel()).toBe(
      "Sem consumo disponível: as contas fixas consomem toda a renda do mês.",
    );
  });

  it("cita o pico (dia e valor) e a média no aria-label", () => {
    const label = variableSpendChartAriaLabel(
      [
        0, 0, 0, 0, 5000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        3000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      ],
      6774,
    ).replace(/\u00a0/g, " ");

    expect(label).toContain("pico de R$ 50,00 no dia 5");
    expect(label).toContain("média de consumo R$ 67,74");
  });

  it("informa ausência de gasto variável sem citar pico", () => {
    const label = variableSpendChartAriaLabel(
      new Array<number>(31).fill(0),
      6774,
    );

    expect(label).toContain("sem gastos variáveis neste mês");
    expect(label).not.toContain("pico");
  });
});

describe("VariableSpendChart (renderização)", () => {
  it("mostra a legenda da média e a faixa de obrigações fora do eixo", () => {
    const html = normal().replace(/\u00a0/g, " ");

    expect(html).toContain("Média de consumo");
    expect(html).toContain("R$ 67,74");
    expect(html).toContain("Obrigações");
    expect(html).toContain("R$ 1.700,00");
  });

  it("desenha a linha da média quando a média é positiva", () => {
    expect(normal()).toContain("<line");
  });

  it("com média zero não desenha linha e exibe a indisponibilidade", () => {
    const html = normal({ averageCents: 0 }).replace(/\u00a0/g, " ");

    expect(html).not.toContain("<line");
    expect(html).toContain(
      "Sem consumo disponível: as contas fixas consomem toda a renda do mês.",
    );
  });

  it("com série toda zero não cria barra positiva e mantém obrigações e média", () => {
    const html = normal({
      variableDailyExpensesCents: new Array<number>(31).fill(0),
    });

    expect(html).toContain("Ainda sem gastos variáveis neste mês");
    expect(barHeights(html).every((height) => height === 0)).toBe(true);
    expect(html).toContain("Média de consumo");
    expect(html).toContain("Obrigações");
  });

  it("destaca o dia de hoje e atenua os dias futuros no mês corrente", () => {
    const html = normal({ elapsedDay: 3, highlightDay: 3 });

    expect(html).toContain('fill="#059669"');
    expect(html).toContain('opacity="0.35"');
  });

  it("em mês fechado não há destaque (sem highlightDay)", () => {
    const html = normal({ elapsedDay: 31, highlightDay: undefined });

    expect(html).not.toContain('fill="#059669"');
    expect(html).not.toContain('opacity="0.35"');
  });

  it("expõe o total de obrigações formatado igual a formatCents", () => {
    const html = normal({ obligationsCents: 170000 });

    expect(html).toContain(formatCents(170000));
  });
});
