import { describe, expect, it } from "vitest";

import { buildMonthHistory, type MonthHistorySnapshot } from "./history";

function snapshot(
  overrides: Partial<MonthHistorySnapshot> & { monthKey: string },
): MonthHistorySnapshot {
  return {
    incomeCents: 100000,
    consumedCents: 0,
    consumedPercent: 0,
    ...overrides,
  };
}

describe("buildMonthHistory", () => {
  it("ordena do mais recente para o mais antigo", () => {
    const history = buildMonthHistory([
      snapshot({ monthKey: "2026-08", consumedPercent: 20 }),
      snapshot({ monthKey: "2026-09", consumedPercent: 30 }),
    ]);

    expect(history.map((entry) => entry.monthKey)).toEqual([
      "2026-09",
      "2026-08",
    ]);
  });

  it("rotula, formata o total e classifica o nível do mês", () => {
    const [entry] = buildMonthHistory([
      snapshot({
        monthKey: "2026-09",
        incomeCents: 100000,
        consumedCents: 90000,
        consumedPercent: 90,
      }),
    ]);

    expect(entry.percent).toBe(90);
    expect(entry.totalCents).toBe(90000);
    expect(entry.label).toBe("setembro de 2026");
    expect(entry.level).toBe("lime");
    expect(entry.levelLabel).toBe("Atenção");
  });

  it("arredonda o percentual exibido", () => {
    const [entry] = buildMonthHistory([
      snapshot({ monthKey: "2026-09", consumedPercent: 34.6 }),
    ]);

    expect(entry.percent).toBe(35);
  });

  it("classifica como neutral sem renda, sem dividir por zero", () => {
    const [entry] = buildMonthHistory([
      snapshot({ monthKey: "2026-09", incomeCents: 0, consumedPercent: 0 }),
    ]);

    expect(entry.level).toBe("neutral");
    expect(entry.levelLabel).toBe("Sem renda cadastrada");
  });

  it("retorna vazio quando não há snapshots", () => {
    expect(buildMonthHistory([])).toEqual([]);
  });
});
