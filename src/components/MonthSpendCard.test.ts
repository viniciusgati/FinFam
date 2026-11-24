import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import MonthSpendCard from "./MonthSpendCard";
import { buildConsumptionModeView } from "@/lib/consumption-mode";

function render(overrides: Partial<Parameters<typeof MonthSpendCard>[0]> = {}) {
  const props = {
    backgroundColor: "hsl(150 40% 40%)",
    percent: 42,
    level: "green" as const,
    invoiceDue: "Vencimento da fatura em 10/04",
    countdownLabel: "8 dias para o fim do ciclo",
    feedback: "Você está gastando abaixo do esperado.",
    incomeCents: 500000,
    consumedCents: 210000,
    projectedCents: 300000,
    ...overrides,
  };
  return renderToStaticMarkup(createElement(MonthSpendCard, props)).replace(
    /\u00a0/g,
    " ",
  );
}

describe("MonthSpendCard (renderização)", () => {
  it("mantém todo o conteúdo do hero: percentual, nível, vencimento e contador do ciclo", () => {
    const html = render();

    expect(html).toContain("Renda do ciclo consumida");
    expect(html).toContain("42");
    expect(html).toContain("Ok");
    expect(html).toContain("Vencimento da fatura em 10/04");
    expect(html).toContain("Ciclo financeiro");
    expect(html).toContain("8 dias para o fim do ciclo");
  });

  it("decompõe o percentual nos valores do mês: renda, consumido, disponível e projeção", () => {
    const html = render();

    expect(html).toContain("Renda do ciclo");
    expect(html).toContain("R$ 5.000,00");
    expect(html).toContain("Já consumido");
    expect(html).toContain("R$ 2.100,00");
    expect(html).toContain("42% da renda");
    expect(html).toContain("Ainda disponível");
    expect(html).toContain("R$ 2.900,00");
    expect(html).toContain("Projeção até o fim do ciclo");
    expect(html).toContain("R$ 3.000,00");
  });

  it("nomeia o estouro quando o consumo passa a renda", () => {
    const html = render({
      percent: 120,
      consumedCents: 600000,
      projectedCents: 660000,
    });

    expect(html).toContain("Estourado em");
    expect(html).toContain("R$ 1.000,00");
    expect(html).not.toContain("Ainda disponível");
  });

  it("renderiza a barra de progresso com o percentual consumido", () => {
    const html = render();

    expect(html).toContain('role="progressbar"');
    expect(html).toContain('aria-valuenow="42"');
    expect(html).toContain('aria-valuetext="42% da renda consumida"');
    expect(html).toContain("width:42%");
  });

  it("limita a barra a 100% quando a renda já foi estourada", () => {
    const html = render({ percent: 120, consumedCents: 600000 });

    expect(html).toContain('aria-valuenow="100"');
    expect(html).toContain("width:100%");
    expect(html).not.toContain("width:120%");
  });

  it("aplica as classes de tipografia e padding do hero", () => {
    const html = render();

    expect(html).toContain("p-6");
    expect(html).toContain("text-5xl");
    expect(html).toContain("sm:text-7xl");
  });

  it("expõe o feedback em role=status com aria-live=polite", () => {
    const html = render();

    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain("Você está gastando abaixo do esperado.");
  });

  it("renderiza o nível do mês", () => {
    const html = render({ level: "orange" });

    expect(html).toContain("Alerta");
  });

  it("não renderiza subtítulo de consumo nem orientação duplicada", () => {
    const html = render();

    expect(html).not.toContain("não inclui contas fixas");
    expect(html).not.toContain("Consumo de");
    expect(html).not.toContain("Restam 7 dias no ciclo");
    expect(html).not.toContain("limite o gasto");
  });

  it("aceita className extra (ex.: md:col-span-2)", () => {
    const html = render({ className: "md:col-span-2" });

    expect(html).toContain("md:col-span-2");
  });

  it("mostra a projeção e o risco quando a projeção estoura a renda", () => {
    const html = render({ projectedPercent: 248, projectedRisk: true });

    expect(html).toContain("No ritmo atual: 248% até o fim do ciclo");
    expect(html).toContain("Risco de estouro");
  });

  it("mostra a projeção sem risco quando abaixo de 100%", () => {
    const html = render({ projectedPercent: 90, projectedRisk: false });

    expect(html).toContain("No ritmo atual: 90% até o fim do ciclo");
    expect(html).not.toContain("Risco de estouro");
  });

  it("não mostra projeção quando projectedPercent está ausente", () => {
    const html = render();

    expect(html).not.toContain("No ritmo atual");
  });

  it("expõe o risco em role=status com aria-live=polite", () => {
    const html = render({ projectedPercent: 248, projectedRisk: true });

    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
  });

  it("leva ao glossário do ciclo e do percentual consumido", () => {
    const html = render();

    expect(html).toContain('href="/ajuda#ciclo"');
    expect(html).toContain('aria-label="Saiba mais sobre Ciclo financeiro"');
    expect(html).toContain('href="/ajuda#percentual-consumido"');
    expect(html).toContain(
      'aria-label="Saiba mais sobre % da renda consumida"',
    );
  });
});

describe("MonthSpendCard no modo VARIABLE_BUDGET", () => {
  function renderVariable(
    variableConsumedCents: number,
    remainingDays = 10,
    overrides: Partial<Parameters<typeof MonthSpendCard>[0]> = {},
  ) {
    const view = buildConsumptionModeView({
      mode: "VARIABLE_BUDGET",
      incomeCents: 200000,
      fixedExpensesCents: 50000,
      variableConsumedCents,
      projectedCents: 160000,
      remainingDays,
    });
    if (!view) throw new Error("esperava view model do modo variável");
    return render({
      percent: view.percent,
      level: view.level,
      feedback: view.feedback,
      title: view.title,
      stats: view.stats,
      ariaValueText: view.ariaValueText,
      incomeCents: 200000,
      consumedCents: 50000 + variableConsumedCents,
      projectedCents: 160000,
      ...overrides,
    });
  }

  it("mostra o cenário dentro do orçamento (60%) com os valores e a diária", () => {
    const html = renderVariable(90000);

    expect(html).toContain("Orçamento variável consumido");
    expect(html).toContain("60");
    expect(html).toContain("Orçamento variável");
    expect(html).toContain("R$ 1.500,00");
    expect(html).toContain("Consumo variável");
    expect(html).toContain("R$ 900,00");
    expect(html).toContain("Ainda disponível");
    expect(html).toContain("R$ 600,00");
    expect(html).toContain("Projeção até o fim do ciclo");
    expect(html).toContain(
      "Dentro do orçamento variável, ainda dá para gastar R$ 60,00 por dia nos 10 dias restantes.",
    );
    expect(html).toContain(
      'aria-valuetext="60% do orçamento variável consumido"',
    );
    expect(html).toContain('aria-valuenow="60"');
    expect(html).not.toContain("Renda do ciclo consumida");
  });

  it("mostra o estouro (120%) com a pausa por dia e a barra limitada a 100", () => {
    const html = renderVariable(180000);

    expect(html).toContain("120");
    expect(html).toContain("Estourado em");
    expect(html).toContain("R$ 300,00");
    expect(html).toContain(
      "Estourado em R$ 300,00. Pausa por dia R$ 30,00 por 10 dias restantes.",
    );
    expect(html).toContain(
      'aria-valuetext="120% do orçamento variável consumido"',
    );
    expect(html).toContain('aria-valuenow="100"');
    expect(html).not.toContain("width:120%");
    expect(html).toContain("Crítico");
  });

  it("renderiza o aviso de orçamento zero em role=status sem NaN/Infinity", () => {
    const view = buildConsumptionModeView({
      mode: "VARIABLE_BUDGET",
      incomeCents: 100000,
      fixedExpensesCents: 100000,
      variableConsumedCents: 50000,
      projectedCents: 120000,
      remainingDays: 10,
    });
    if (!view) throw new Error("esperava view model do modo variável");

    const html = render({
      percent: view.percent,
      level: view.level,
      feedback: view.feedback,
      title: view.title,
      stats: view.stats,
      ariaValueText: view.ariaValueText,
      statusNote: view.pausePerDayLabel ?? undefined,
    });

    expect(html).toContain(
      "Sem orçamento variável: os gastos fixos consomem toda a renda do ciclo.",
    );
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-valuenow="0"');
    expect(html).toContain("Consumo variável");
    expect(html).toContain("R$ 500,00");
    expect(html).toContain("Estourado em");
    expect(html).toContain("Pausa por dia R$ 50,00");
    expect(html).not.toContain("NaN");
    expect(html).not.toContain("Infinity");
  });
});
