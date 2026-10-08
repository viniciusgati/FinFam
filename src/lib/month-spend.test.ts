import { describe, expect, it } from "vitest";
import { buildMonthSpendStats, type MonthSpendStat } from "./month-spend";

/** Normaliza o espaço não separável do `formatCents` antes de comparar. */
function plain(stat: MonthSpendStat): MonthSpendStat {
  return { ...stat, value: stat.value.replace(/\u00a0/g, " ") };
}

describe("buildMonthSpendStats", () => {
  it("decompõe o percentual em renda, consumo, sobra e projeção", () => {
    const stats = buildMonthSpendStats({
      incomeCents: 500000,
      consumedCents: 440000,
      projectedCents: 480000,
      consumedPercent: 88,
    }).map(plain);

    expect(stats).toEqual([
      {
        key: "income",
        label: "Renda do mês",
        value: "R$ 5.000,00",
        detail: null,
      },
      {
        key: "consumed",
        label: "Já consumido",
        value: "R$ 4.400,00",
        detail: "88% da renda",
      },
      {
        key: "available",
        label: "Ainda disponível",
        value: "R$ 600,00",
        detail: null,
      },
      {
        key: "projection",
        label: "Projeção até o fim do mês",
        value: "R$ 4.800,00",
        detail: null,
      },
    ]);
  });

  it("nomeia o estouro e exibe o excedente como valor positivo", () => {
    const stats = buildMonthSpendStats({
      incomeCents: 300000,
      consumedCents: 330000,
      projectedCents: 360000,
      consumedPercent: 110,
    }).map(plain);

    expect(stats[2]).toEqual({
      key: "available",
      label: "Estourado em",
      value: "R$ 300,00",
      detail: null,
    });
  });

  it("trata consumo igual à renda como disponível zerado, não estouro", () => {
    const stats = buildMonthSpendStats({
      incomeCents: 300000,
      consumedCents: 300000,
      projectedCents: 300000,
      consumedPercent: 100,
    }).map(plain);

    expect(stats[2]).toEqual({
      key: "available",
      label: "Ainda disponível",
      value: "R$ 0,00",
      detail: null,
    });
  });

  it("arredonda o percentual exibido e normaliza entradas negativas", () => {
    const stats = buildMonthSpendStats({
      incomeCents: -100,
      consumedCents: -200,
      projectedCents: -300,
      consumedPercent: 87.5,
    }).map(plain);

    expect(stats[0].value).toBe("R$ 0,00");
    expect(stats[1].detail).toBe("88% da renda");
    expect(stats[3].value).toBe("R$ 0,00");
  });
});
