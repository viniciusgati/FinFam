import { describe, expect, it } from "vitest";
import {
  AMOUNT_ERROR,
  DATE_ERROR,
  DESCRIPTION_ERROR,
  buildQuickIncomePayload,
  mapQuickIncomeFieldErrors,
  validateQuickIncome,
} from "./quick-income";
import { createVariableIncomeSchema } from "./variable-incomes";

const validInput = {
  description: "Venda",
  amount: "12,34",
  date: "2026-10-07",
};

describe("validateQuickIncome", () => {
  it("marca descrição vazia ou só com espaços", () => {
    expect(validateQuickIncome({ ...validInput, description: "" })).toEqual({
      description: DESCRIPTION_ERROR,
    });
    expect(validateQuickIncome({ ...validInput, description: "   " })).toEqual({
      description: "Informe uma descrição.",
    });
  });

  it("marca valor vazio, não numérico ou zero", () => {
    for (const amount of ["", "abc", "0"]) {
      expect(validateQuickIncome({ ...validInput, amount })).toEqual({
        amount: AMOUNT_ERROR,
      });
    }
  });

  it("acumula os erros de descrição e de valor", () => {
    expect(
      validateQuickIncome({
        description: "  ",
        amount: "12,345",
        date: "2026-10-07",
      }),
    ).toEqual({
      description: DESCRIPTION_ERROR,
      amount: "Informe um valor válido (ex.: 12,34).",
    });
  });

  it("marca data fora do formato ou inexistente no calendário", () => {
    expect(validateQuickIncome({ ...validInput, date: "07/10/2026" })).toEqual({
      date: DATE_ERROR,
    });
    expect(validateQuickIncome({ ...validInput, date: "2026-02-30" })).toEqual({
      date: DATE_ERROR,
    });
  });

  it("não retorna erros para entrada válida", () => {
    expect(validateQuickIncome(validInput)).toEqual({});
  });
});

describe("buildQuickIncomePayload", () => {
  it("apara a descrição e converte o valor pt-BR para centavos", () => {
    expect(
      buildQuickIncomePayload({
        description: "  Venda  ",
        amount: "12,34",
        date: "2026-10-07",
      }),
    ).toEqual({ description: "Venda", amountCents: 1234, date: "2026-10-07" });
    expect(
      buildQuickIncomePayload({ ...validInput, amount: "1.234,56" })
        ?.amountCents,
    ).toBe(123456);
  });

  it("monta payload somente com descrição, valor e data", () => {
    const payload = buildQuickIncomePayload(validInput);

    expect(payload).not.toBeNull();
    if (!payload) return;
    expect(Object.keys(payload).sort()).toEqual([
      "amountCents",
      "date",
      "description",
    ]);
    expect(payload).not.toHaveProperty("category");
    expect(payload).not.toHaveProperty("paymentMethod");
    expect(payload).not.toHaveProperty("paid");
  });

  it("passa no schema do endpoint existente", () => {
    const payload = buildQuickIncomePayload(validInput);

    expect(payload).not.toBeNull();
    if (!payload) return;
    expect(createVariableIncomeSchema.safeParse(payload).success).toBe(true);
  });

  it("devolve null quando a entrada é inválida", () => {
    expect(
      buildQuickIncomePayload({
        description: "",
        amount: "0",
        date: "2026-10-07",
      }),
    ).toBeNull();
    expect(
      buildQuickIncomePayload({ ...validInput, amount: "abc" }),
    ).toBeNull();
    expect(
      buildQuickIncomePayload({ ...validInput, date: "2026-02-30" }),
    ).toBeNull();
  });
});

describe("mapQuickIncomeFieldErrors", () => {
  it("traduz os fieldErrors da API para as mensagens em pt-BR", () => {
    expect(
      mapQuickIncomeFieldErrors({
        description: ["Expected string, received undefined"],
        amountCents: ["Expected number, received nan"],
        date: ["Invalid date"],
      }),
    ).toEqual({
      description: "Informe uma descrição.",
      amount: "Informe um valor válido (ex.: 12,34).",
      date: "Informe uma data válida.",
    });
  });

  it("ignora fieldErrors ausentes", () => {
    expect(mapQuickIncomeFieldErrors(undefined)).toEqual({});
    expect(mapQuickIncomeFieldErrors({})).toEqual({});
  });
});
