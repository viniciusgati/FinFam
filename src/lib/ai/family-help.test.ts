import { describe, expect, it } from "vitest";

import type { FamilyInsightInput } from "../family-insights";
import {
  buildFamilyHelpData,
  buildFamilyHelpPrompt,
  FAMILY_HELP_BUTTON_LABEL,
  FAMILY_HELP_BUTTON_LOADING_LABEL,
  FAMILY_HELP_ERROR_MESSAGE,
  FAMILY_HELP_INCOME_SHORTFALL_TEXT,
  FAMILY_HELP_LOADING_MESSAGE,
  FAMILY_HELP_UNAVAILABLE_TEXT,
  localFamilyHelp,
} from "./family-help";

function input(overrides: Partial<FamilyInsightInput> = {}): FamilyInsightInput {
  return {
    referenceMonthKey: "2026-10",
    currentCategories: [],
    windowSnapshots: [],
    monthlyIncomeCents: 1000000,
    fixedExpensesCents: 0,
    todayVariableSpendCents: null,
    dailyReferenceCents: null,
    ...overrides,
  };
}

describe("buildFamilyHelpData", () => {
  it("deriva apenas números e desvios anônimos (sem rótulos)", () => {
    const data = buildFamilyHelpData(
      input({
        monthlyIncomeCents: 300000,
        fixedExpensesCents: 300000,
        currentCategories: [{ category: "Mercado", amountCents: 30000 }],
        windowSnapshots: [
          {
            monthKey: "2026-09",
            categories: [{ category: "Mercado", amountCents: 25000 }],
          },
        ],
        todayVariableSpendCents: 15000,
        dailyReferenceCents: 10000,
      }),
    );

    expect(data.overCommitted).toBe(1);
    expect(data.windowSnapshotCount).toBe(1);
    expect(data.dailyVariationFactor).toBe(1.5);
    expect(data.categoryDeviationPercents).toEqual([20]);
    expect(JSON.stringify(data)).not.toContain("Mercado");
  });
});

describe("buildFamilyHelpPrompt", () => {
  it("usa JSON numérico no user, sem nomes de categoria nem texto do usuário", () => {
    const data = buildFamilyHelpData(
      input({
        currentCategories: [{ category: "Alimentação", amountCents: 30000 }],
        windowSnapshots: [
          {
            monthKey: "2026-09",
            categories: [{ category: "Alimentação", amountCents: 25000 }],
          },
        ],
      }),
    );

    const [system, user] = buildFamilyHelpPrompt(data);

    expect(system.role).toBe("system");
    expect(user.role).toBe("user");
    expect(user.content).not.toContain("Alimentação");

    const parsed = JSON.parse(user.content) as Record<string, unknown>;
    for (const value of Object.values(parsed)) {
      if (Array.isArray(value)) {
        expect(value.every((entry) => typeof entry === "number")).toBe(true);
      } else {
        expect(typeof value).toBe("number");
      }
    }
  });
});

describe("localFamilyHelp", () => {
  it("usa o texto de renda insuficiente quando as fixas cobrem a renda", () => {
    const data = buildFamilyHelpData(
      input({ monthlyIncomeCents: 100000, fixedExpensesCents: 100000 }),
    );

    expect(localFamilyHelp(data)).toBe(FAMILY_HELP_INCOME_SHORTFALL_TEXT);
  });

  it("usa o texto geral quando há renda disponível", () => {
    const data = buildFamilyHelpData(
      input({ monthlyIncomeCents: 100000, fixedExpensesCents: 50000 }),
    );

    expect(localFamilyHelp(data)).toBe(FAMILY_HELP_UNAVAILABLE_TEXT);
  });
});

describe("textos fixados do card", () => {
  it("mantém os rótulos e mensagens exatos", () => {
    expect(FAMILY_HELP_BUTTON_LABEL).toBe("Gerar resumo da IA");
    expect(FAMILY_HELP_BUTTON_LOADING_LABEL).toBe("Gerando resumo…");
    expect(FAMILY_HELP_LOADING_MESSAGE).toBe("Gerando resumo com IA…");
    expect(FAMILY_HELP_ERROR_MESSAGE).toBe(
      "Resumo por IA indisponível no momento",
    );
  });
});
