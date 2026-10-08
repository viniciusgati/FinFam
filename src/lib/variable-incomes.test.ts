import { describe, expect, it } from "vitest";
import {
  createVariableIncomeSchema,
  updateVariableIncomeSchema,
} from "./variable-incomes";

describe("createVariableIncomeSchema", () => {
  it("aceita descrição, valor positivo e data (com trim)", () => {
    const parsed = createVariableIncomeSchema.safeParse({
      description: "  Vendi a bicicleta  ",
      amountCents: 35000,
      date: "2026-10-03",
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.description).toBe("Vendi a bicicleta");
      expect(parsed.data.amountCents).toBe(35000);
      expect(parsed.data.date.toISOString()).toBe("2026-10-03T00:00:00.000Z");
    }
  });

  it.each([
    [
      "descrição vazia",
      { description: "  ", amountCents: 1000, date: "2026-10-03" },
    ],
    ["valor zero", { description: "Venda", amountCents: 0, date: "2026-10-03" }],
    [
      "valor negativo",
      { description: "Venda", amountCents: -100, date: "2026-10-03" },
    ],
    [
      "valor fracionado",
      { description: "Venda", amountCents: 10.5, date: "2026-10-03" },
    ],
    ["data inválida", { description: "Venda", amountCents: 1000, date: "x" }],
  ])("rejeita %s", (_label, payload) => {
    expect(createVariableIncomeSchema.safeParse(payload).success).toBe(false);
  });
});

describe("updateVariableIncomeSchema", () => {
  it("aceita atualização parcial", () => {
    const parsed = updateVariableIncomeSchema.safeParse({ amountCents: 4200 });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data).toEqual({ amountCents: 4200 });
    }
  });

  it("rejeita corpo vazio", () => {
    expect(updateVariableIncomeSchema.safeParse({}).success).toBe(false);
  });
});
