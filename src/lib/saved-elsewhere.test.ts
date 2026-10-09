import { describe, expect, it } from "vitest";
import { savedElsewhereMessage } from "./saved-elsewhere";

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
