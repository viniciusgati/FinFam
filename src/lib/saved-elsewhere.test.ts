import { describe, expect, it } from "vitest";
import {
  cycleSavedElsewhereMessage,
  savedElsewhereMessage,
} from "./saved-elsewhere";

describe("savedElsewhereMessage", () => {
  it("devolve a base cru, sem ponto, quando o mês salvo é o selecionado", () => {
    expect(
      savedElsewhereMessage({
        baseMessage: "Gasto criado",
        savedMonthKey: "2026-10",
        selectedMonthKey: "2026-10",
      }),
    ).toBe("Gasto criado");
    expect(
      savedElsewhereMessage({
        baseMessage: "Entrada criada",
        savedMonthKey: "2026-10",
        selectedMonthKey: "2026-10",
      }),
    ).toBe("Entrada criada");
    expect(
      savedElsewhereMessage({
        baseMessage: "Alterações salvas",
        savedMonthKey: "2026-10",
        selectedMonthKey: "2026-10",
      }),
    ).toBe("Alterações salvas");
  });

  it("informa o rótulo pt-BR do mês de destino quando salva fora do mês selecionado", () => {
    expect(
      savedElsewhereMessage({
        baseMessage: "Gasto criado",
        savedMonthKey: "2026-11",
        selectedMonthKey: "2026-10",
      }),
    ).toBe("Gasto criado para outro mês (novembro de 2026).");
    expect(
      savedElsewhereMessage({
        baseMessage: "Entrada criada",
        savedMonthKey: "2026-11",
        selectedMonthKey: "2026-10",
      }),
    ).toBe("Entrada criada para outro mês (novembro de 2026).");
  });

  it("cobre a virada de ano (2026-12 → 2027-01)", () => {
    expect(
      savedElsewhereMessage({
        baseMessage: "Entrada criada",
        savedMonthKey: "2027-01",
        selectedMonthKey: "2026-12",
      }),
    ).toBe("Entrada criada para outro mês (janeiro de 2027).");
  });

  it("cobre edição que move o lançamento para outro mês", () => {
    expect(
      savedElsewhereMessage({
        baseMessage: "Alterações salvas",
        savedMonthKey: "2026-11",
        selectedMonthKey: "2026-10",
      }),
    ).toBe("Alterações salvas para outro mês (novembro de 2026).");
  });
});

describe("cycleSavedElsewhereMessage", () => {
  const windowStart = "2026-09-15";
  const windowNextStart = "2026-10-15";

  it("não avisa outro mês dentro da janela, mesmo com cycleStartDay > 1", () => {
    expect(
      cycleSavedElsewhereMessage({
        baseMessage: "Gasto criado",
        savedDate: "2026-10-05",
        selectedMonthKey: "2026-09",
        windowStart,
        windowNextStart,
      }),
    ).toBe("Gasto criado");
    expect(
      cycleSavedElsewhereMessage({
        baseMessage: "Entrada criada",
        savedDate: "2026-09-15",
        selectedMonthKey: "2026-09",
        windowStart,
        windowNextStart,
      }),
    ).toBe("Entrada criada");
  });

  it("avisa o mês da data quando ela cai fora da janela", () => {
    expect(
      cycleSavedElsewhereMessage({
        baseMessage: "Gasto criado",
        savedDate: "2026-11-20",
        selectedMonthKey: "2026-10",
        windowStart: "2026-10-15",
        windowNextStart: "2026-11-15",
      }),
    ).toBe("Gasto criado para outro mês (novembro de 2026).");
    expect(
      cycleSavedElsewhereMessage({
        baseMessage: "Entrada criada",
        savedDate: "2026-11-20",
        selectedMonthKey: "2026-10",
        windowStart: "2026-10-15",
        windowNextStart: "2026-11-15",
      }),
    ).toBe("Entrada criada para outro mês (novembro de 2026).");
  });

  it("avisa mesmo quando o mês da data coincide com o mês do ciclo", () => {
    expect(
      cycleSavedElsewhereMessage({
        baseMessage: "Gasto criado",
        savedDate: "2026-09-10",
        selectedMonthKey: "2026-09",
        windowStart,
        windowNextStart,
      }),
    ).toBe("Gasto criado para outro mês (setembro de 2026).");
  });

  it("sem janela delega ao comportamento por mês de /gastos", () => {
    expect(
      cycleSavedElsewhereMessage({
        baseMessage: "Entrada criada",
        savedDate: "2026-10-07",
        selectedMonthKey: "2026-10",
      }),
    ).toBe("Entrada criada");
    expect(
      cycleSavedElsewhereMessage({
        baseMessage: "Entrada criada",
        savedDate: "2026-11-07",
        selectedMonthKey: "2026-10",
      }),
    ).toBe("Entrada criada para outro mês (novembro de 2026).");
  });
});
