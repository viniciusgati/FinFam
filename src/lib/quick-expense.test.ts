import { describe, expect, it } from "vitest";
import {
  AMOUNT_ERROR,
  DATE_ERROR,
  DESCRIPTION_ERROR,
  buildQuickExpensePayload,
  isValidDateISO,
  mapQuickExpenseFieldErrors,
  todayISO,
  validateQuickExpense,
} from "./quick-expense";
import { createVariableExpenseSchema } from "./variable-expenses";

const validInput = {
  description: "Feira",
  amount: "12,34",
  date: "2026-10-07",
};

describe("validateQuickExpense", () => {
  it("marca descrição vazia ou só com espaços", () => {
    expect(validateQuickExpense({ ...validInput, description: "" })).toEqual({
      description: DESCRIPTION_ERROR,
    });
    expect(validateQuickExpense({ ...validInput, description: "   " })).toEqual({
      description: "Informe uma descrição.",
    });
  });

  it("marca valor vazio, não numérico ou zero", () => {
    for (const amount of ["", "abc", "0"]) {
      expect(validateQuickExpense({ ...validInput, amount })).toEqual({
        amount: AMOUNT_ERROR,
      });
    }
  });

  it("acumula os erros de descrição e de valor", () => {
    expect(
      validateQuickExpense({
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
    expect(
      validateQuickExpense({ ...validInput, date: "07/10/2026" }),
    ).toEqual({ date: DATE_ERROR });
    expect(validateQuickExpense({ ...validInput, date: "2026-02-30" })).toEqual({
      date: DATE_ERROR,
    });
  });

  it("não retorna erros para entrada válida", () => {
    expect(validateQuickExpense(validInput)).toEqual({});
  });

  it("não exige categoria (opcional, inclusive vazia)", () => {
    expect(validateQuickExpense({ ...validInput, category: "" })).toEqual({});
    expect(validateQuickExpense({ ...validInput, category: "   " })).toEqual({});
    expect(validateQuickExpense({ ...validInput, category: "Feira" })).toEqual(
      {},
    );
  });
});

describe("buildQuickExpensePayload", () => {
  it("converte o valor pt-BR para centavos", () => {
    expect(
      buildQuickExpensePayload({ ...validInput, amount: "12,34" })?.amountCents,
    ).toBe(1234);
    expect(
      buildQuickExpensePayload({ ...validInput, amount: "1.234,56" })
        ?.amountCents,
    ).toBe(123456);
  });

  it("fixa PIX e pago e passa no schema do endpoint existente", () => {
    const payload = buildQuickExpensePayload(validInput);

    expect(payload).not.toBeNull();
    if (!payload) return;
    expect(payload.paymentMethod).toBe("PIX");
    expect(payload.paid).toBe(true);
    expect(payload.date).toBe("2026-10-07");
    expect(createVariableExpenseSchema.safeParse(payload).success).toBe(true);
  });

  it("normaliza a categoria e envia null quando vazia ou ausente", () => {
    expect(buildQuickExpensePayload(validInput)?.category).toBeNull();
    expect(
      buildQuickExpensePayload({ ...validInput, category: "   " })?.category,
    ).toBeNull();
    expect(
      buildQuickExpensePayload({ ...validInput, category: "  mercado  " })
        ?.category,
    ).toBe("mercado");
    expect(
      buildQuickExpensePayload({ ...validInput, category: "Mercado   do  bairro" })
        ?.category,
    ).toBe("Mercado do bairro");
  });

  it("gera payload válido com e sem categoria", () => {
    const withCategory = buildQuickExpensePayload({
      ...validInput,
      category: "Mercado",
    });
    const withoutCategory = buildQuickExpensePayload(validInput);

    expect(withCategory).not.toBeNull();
    expect(withoutCategory).not.toBeNull();
    if (!withCategory || !withoutCategory) return;
    expect(createVariableExpenseSchema.safeParse(withCategory).success).toBe(
      true,
    );
    expect(createVariableExpenseSchema.safeParse(withoutCategory).success).toBe(
      true,
    );
  });

  it("devolve null quando a entrada é inválida", () => {
    expect(
      buildQuickExpensePayload({
        description: "",
        amount: "0",
        date: "2026-10-07",
      }),
    ).toBeNull();
    expect(
      buildQuickExpensePayload({
        ...validInput,
        date: "2026-02-30",
      }),
    ).toBeNull();
  });
});

describe("isValidDateISO", () => {
  it("aceita datas reais e rejeita dias inexistentes", () => {
    expect(isValidDateISO("2026-10-07")).toBe(true);
    expect(isValidDateISO("2024-02-29")).toBe(true);
    expect(isValidDateISO("2026-02-29")).toBe(false);
    expect(isValidDateISO("2026-13-01")).toBe(false);
    expect(isValidDateISO("2026-1-1")).toBe(false);
  });
});

describe("todayISO", () => {
  it("formata a data no padrão YYYY-MM-DD no fuso da família", () => {
    expect(todayISO(new Date("2026-10-07T15:30:00.000Z"))).toBe("2026-10-07");
    expect(todayISO(new Date("2026-01-01T00:00:00.000Z"))).toBe("2025-12-31");
  });

  it("usa o dia local na virada do dia (23:30 BRT)", () => {
    const instante = new Date("2026-11-01T02:30:00.000Z");
    expect(todayISO(instante, "America/Sao_Paulo")).toBe("2026-10-31");
    expect(todayISO(instante)).toBe("2026-10-31");
  });

  it("reflete o dia local de um fuso enviesado (Asia/Tokyo)", () => {
    expect(
      todayISO(new Date("2026-10-07T15:30:00.000Z"), "Asia/Tokyo"),
    ).toBe("2026-10-08");
  });
});

describe("mapQuickExpenseFieldErrors", () => {
  it("traduz os fieldErrors da API para as mensagens em pt-BR", () => {
    expect(
      mapQuickExpenseFieldErrors({
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
    expect(mapQuickExpenseFieldErrors(undefined)).toEqual({});
    expect(mapQuickExpenseFieldErrors({})).toEqual({});
  });
});
