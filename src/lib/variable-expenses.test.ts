import { describe, expect, it } from "vitest";
import {
  createVariableExpenseSchema,
  currentMonthParam,
  isCountedInBudget,
  isValidMonthParam,
  monthLabel,
  monthRange,
  updateVariableExpenseSchema,
} from "./variable-expenses";

describe("isCountedInBudget", () => {
  it("não conta crédito no orçamento", () => {
    expect(isCountedInBudget("CREDIT")).toBe(false);
  });

  it("conta dinheiro, débito e pix", () => {
    expect(isCountedInBudget("CASH")).toBe(true);
    expect(isCountedInBudget("DEBIT")).toBe(true);
    expect(isCountedInBudget("PIX")).toBe(true);
  });
});

describe("monthRange", () => {
  it("monta o intervalo semiaberto do mês no fuso da família", () => {
    const range = monthRange("2026-10", "America/Sao_Paulo");

    expect(range.gte.toISOString()).toBe("2026-10-01T03:00:00.000Z");
    expect(range.lt.toISOString()).toBe("2026-11-01T03:00:00.000Z");
  });

  it("usa America/Sao_Paulo por default", () => {
    const range = monthRange("2026-10");

    expect(range.gte.toISOString()).toBe("2026-10-01T03:00:00.000Z");
    expect(range.lt.toISOString()).toBe("2026-11-01T03:00:00.000Z");
  });

  it("vira o ano em dezembro", () => {
    const range = monthRange("2026-12", "America/Sao_Paulo");

    expect(range.gte.toISOString()).toBe("2026-12-01T03:00:00.000Z");
    expect(range.lt.toISOString()).toBe("2027-01-01T03:00:00.000Z");
  });

  it("desloca os limites para um fuso enviesado (Asia/Tokyo)", () => {
    const range = monthRange("2026-10", "Asia/Tokyo");

    expect(range.gte.toISOString()).toBe("2026-09-30T15:00:00.000Z");
    expect(range.lt.toISOString()).toBe("2026-10-31T15:00:00.000Z");
  });

  it("rejeita mês fora do formato", () => {
    expect(() => monthRange("2026-13")).toThrow();
  });
});

describe("isValidMonthParam", () => {
  it("aceita YYYY-MM válido", () => {
    expect(isValidMonthParam("2026-10")).toBe(true);
    expect(isValidMonthParam("2026-01")).toBe(true);
    expect(isValidMonthParam("2026-12")).toBe(true);
  });

  it("rejeita mês, formato e ausência inválidos", () => {
    expect(isValidMonthParam("2026-13")).toBe(false);
    expect(isValidMonthParam("2026-00")).toBe(false);
    expect(isValidMonthParam("2026-1")).toBe(false);
    expect(isValidMonthParam("2026/10")).toBe(false);
    expect(isValidMonthParam("")).toBe(false);
    expect(isValidMonthParam(null)).toBe(false);
    expect(isValidMonthParam(undefined)).toBe(false);
  });
});

describe("currentMonthParam", () => {
  it("formata o mês de referência no fuso da família", () => {
    expect(currentMonthParam(new Date("2026-10-15T12:00:00.000Z"))).toBe(
      "2026-10",
    );
  });

  it("usa o mês local na virada do mês (23:30 BRT)", () => {
    const instante = new Date("2026-11-01T02:30:00.000Z");

    expect(currentMonthParam(instante, "America/Sao_Paulo")).toBe("2026-10");
    expect(currentMonthParam(instante)).toBe("2026-10");
  });

  it("reflete o mês local de um fuso enviesado (Asia/Tokyo)", () => {
    expect(
      currentMonthParam(new Date("2026-11-01T02:30:00.000Z"), "Asia/Tokyo"),
    ).toBe("2026-11");
  });
});

describe("monthLabel", () => {
  it("descreve o mês em português", () => {
    expect(monthLabel("2026-10")).toBe("outubro de 2026");
    expect(monthLabel("2026-01")).toBe("janeiro de 2026");
  });
});

const validPayload = {
  description: "Mercado",
  amountCents: 1234,
  date: "2026-10-15T00:00:00.000Z",
  category: "Alimentação",
  paymentMethod: "PIX",
  paid: true,
} as const;

describe("createVariableExpenseSchema", () => {
  it("aceita um payload válido e converte a data", () => {
    const parsed = createVariableExpenseSchema.safeParse(validPayload);

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.amountCents).toBe(1234);
      expect(parsed.data.date).toBeInstanceOf(Date);
      expect(parsed.data.date.toISOString()).toBe("2026-10-15T00:00:00.000Z");
    }
  });

  it("rejeita valor não inteiro", () => {
    expect(
      createVariableExpenseSchema.safeParse({ ...validPayload, amountCents: 12.5 })
        .success,
    ).toBe(false);
  });

  it("rejeita valor negativo", () => {
    expect(
      createVariableExpenseSchema.safeParse({ ...validPayload, amountCents: -1 })
        .success,
    ).toBe(false);
  });

  it("rejeita forma de pagamento fora do enum", () => {
    expect(
      createVariableExpenseSchema.safeParse({
        ...validPayload,
        paymentMethod: "BOLETO",
      }).success,
    ).toBe(false);
  });

  it("rejeita data inválida", () => {
    expect(
      createVariableExpenseSchema.safeParse({ ...validPayload, date: "nope" })
        .success,
    ).toBe(false);
  });

  it("rejeita descrição vazia", () => {
    expect(
      createVariableExpenseSchema.safeParse({ ...validPayload, description: "  " })
        .success,
    ).toBe(false);
  });
});

describe("updateVariableExpenseSchema", () => {
  it("aceita objeto parcial não vazio", () => {
    const parsed = updateVariableExpenseSchema.safeParse({ paid: false });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data).toEqual({ paid: false });
    }
  });

  it("rejeita objeto vazio", () => {
    expect(updateVariableExpenseSchema.safeParse({}).success).toBe(false);
  });

  it("rejeita campo parcial inválido", () => {
    expect(
      updateVariableExpenseSchema.safeParse({ amountCents: -5 }).success,
    ).toBe(false);
  });
});
