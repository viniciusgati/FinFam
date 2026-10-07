import { describe, expect, it } from "vitest";
import { dateMaskToIso, isoToDateMask, maskDate, maskMonth } from "./mask";

describe("maskMonth", () => {
  it("insere o hífen após o 4º dígito", () => {
    expect(maskMonth("202601")).toBe("2026-01");
    expect(maskMonth("20261")).toBe("2026-1");
  });

  it("não deixa hífen residual em ano parcial", () => {
    expect(maskMonth("2026")).toBe("2026");
    expect(maskMonth("2026-")).toBe("2026");
  });

  it("mantém mês fora do intervalo para a validação existente reclamar", () => {
    expect(maskMonth("202613")).toBe("2026-13");
  });

  it("descarta o excedente acima de 6 dígitos", () => {
    expect(maskMonth("20261234567")).toBe("2026-12");
  });

  it("descarta caracteres não-dígito na redigitação", () => {
    expect(maskMonth("20a26-01x")).toBe("2026-01");
  });

  it("Backspace remove o separador junto, sem deixar hífen órfão", () => {
    expect(maskMonth("2026-")).toBe("2026");
    expect(maskMonth("202")).toBe("202");
  });
});

describe("maskDate", () => {
  it("formata a data completa", () => {
    expect(maskDate("07102026")).toBe("07/10/2026");
  });

  it("formata a data parcial", () => {
    expect(maskDate("071")).toBe("07/1");
    expect(maskDate("07")).toBe("07");
  });

  it("aceita entrada vazia", () => {
    expect(maskDate("")).toBe("");
  });

  it("converte data ISO colada para dia primeiro", () => {
    expect(maskDate("2026-10-07")).toBe("07/10/2026");
  });

  it("descarta o excedente acima de 8 dígitos", () => {
    expect(maskDate("071020261234")).toBe("07/10/2026");
  });

  it("Backspace remove o separador junto, sem deixar barra órfã", () => {
    expect(maskDate("07/10/")).toBe("07/10");
    expect(maskDate("07/")).toBe("07");
  });

  it("descarta caracteres não-dígito na redigitação", () => {
    expect(maskDate("07x10.2026")).toBe("07/10/2026");
  });
});

describe("dateMaskToIso", () => {
  it("converte a máscara completa para ISO", () => {
    expect(dateMaskToIso("07/10/2026")).toBe("2026-10-07");
  });

  it("retorna null para máscara incompleta", () => {
    expect(dateMaskToIso("07/10")).toBeNull();
    expect(dateMaskToIso("")).toBeNull();
  });

  it("retorna null para data impossível", () => {
    expect(dateMaskToIso("31/02/2026")).toBeNull();
    expect(dateMaskToIso("07/13/2026")).toBeNull();
  });

  it("aceita 29/02 em ano bissexto", () => {
    expect(dateMaskToIso("29/02/2024")).toBe("2024-02-29");
    expect(dateMaskToIso("29/02/2026")).toBeNull();
  });
});

describe("isoToDateMask", () => {
  it("converte ISO para a máscara", () => {
    expect(isoToDateMask("2026-10-07")).toBe("07/10/2026");
    expect(isoToDateMask("2026-10-07T00:00:00")).toBe("07/10/2026");
  });

  it("retorna vazio para string vazia e entrada fora do padrão", () => {
    expect(isoToDateMask("")).toBe("");
    expect(isoToDateMask("07/10/2026")).toBe("");
    expect(isoToDateMask("2026-13-40")).toBe("");
  });
});
