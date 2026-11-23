import { describe, expect, it } from "vitest";
import {
  savingsGoalInputToCents,
  savingsGoalPreview,
  savingsGoalProgress,
  savingsGoalSavedCents,
} from "./savings-goal";

const normalize = (value: string) => value.replace(/\u00a0/g, " ");

describe("savingsGoalPreview", () => {
  it("converte a meta em valor diário com texto exato", () => {
    expect(normalize(savingsGoalPreview(30000, 30))).toBe(
      "Sua meta equivale a R$ 10,00 por dia.",
    );
    expect(normalize(savingsGoalPreview(10000, 30))).toBe(
      "Sua meta equivale a R$ 3,33 por dia.",
    );
  });

  it("arredonda para o centavo mais próximo", () => {
    expect(normalize(savingsGoalPreview(1000, 3))).toBe(
      "Sua meta equivale a R$ 3,33 por dia.",
    );
    expect(normalize(savingsGoalPreview(1000, 8))).toBe(
      "Sua meta equivale a R$ 1,25 por dia.",
    );
  });

  it("não gera Infinity/NaN quando a janela é inválida", () => {
    expect(normalize(savingsGoalPreview(30000, 0))).toBe(
      "Sua meta equivale a R$ 300,00 por dia.",
    );
  });
});

describe("savingsGoalInputToCents", () => {
  it("trata campo vazio como sem meta", () => {
    expect(savingsGoalInputToCents("")).toBeNull();
    expect(savingsGoalInputToCents("   ")).toBeNull();
  });

  it("converte valor em reais para centavos inteiros", () => {
    expect(savingsGoalInputToCents("1000")).toBe(100000);
    expect(savingsGoalInputToCents("1.000,00")).toBe(100000);
    expect(savingsGoalInputToCents("1.234,56")).toBe(123456);
    expect(savingsGoalInputToCents("10,50")).toBe(1050);
  });

  it("aceita zero como ausência de meta", () => {
    expect(savingsGoalInputToCents("0")).toBe(0);
    expect(savingsGoalInputToCents("0,00")).toBe(0);
  });

  it("rejeita valores inválidos ou negativos", () => {
    expect(savingsGoalInputToCents("abc")).toBeNull();
    expect(savingsGoalInputToCents("-10")).toBeNull();
    expect(savingsGoalInputToCents("10,999")).toBeNull();
  });
});

describe("savingsGoalSavedCents", () => {
  it("projeta o orçamento variável pelos dias decorridos e desconta o gasto", () => {
    expect(
      savingsGoalSavedCents({
        incomeCents: 600000,
        fixedExpensesCents: 300000,
        variableSpentCents: 50000,
        elapsedDays: 10,
        windowDays: 30,
      }),
    ).toBe(50000);
  });

  it("nunca deixa o guardado negativo", () => {
    expect(
      savingsGoalSavedCents({
        incomeCents: 600000,
        fixedExpensesCents: 300000,
        variableSpentCents: 200000,
        elapsedDays: 10,
        windowDays: 30,
      }),
    ).toBe(0);
  });

  it("trata renda menor que as fixas como orçamento variável zero", () => {
    expect(
      savingsGoalSavedCents({
        incomeCents: 200000,
        fixedExpensesCents: 300000,
        variableSpentCents: 0,
        elapsedDays: 10,
        windowDays: 30,
      }),
    ).toBe(0);
  });

  it("não divide por zero quando a janela é inválida", () => {
    const saved = savingsGoalSavedCents({
      incomeCents: 600000,
      fixedExpensesCents: 300000,
      variableSpentCents: 0,
      elapsedDays: 1,
      windowDays: 0,
    });
    expect(saved).toBe(300000);
    expect(Number.isFinite(saved)).toBe(true);
  });

  it("regressão: meta atingida no início do ciclo não deve aparecer sem guardado real", () => {
    const savedCents = savingsGoalSavedCents({
      incomeCents: 600000,
      fixedExpensesCents: 300000,
      variableSpentCents: 0,
      elapsedDays: 1,
      windowDays: 30,
    });
    expect(savedCents).toBe(10000);

    const progress = savingsGoalProgress({
      goalCents: 100000,
      savedCents,
      remainingDays: 20,
    });
    expect(progress?.percent).toBe(10);
    expect(progress?.achieved).toBe(false);
  });
});

describe("savingsGoalProgress", () => {
  it("retorna null quando não há meta", () => {
    expect(
      savingsGoalProgress({ goalCents: null, savedCents: 25000, remainingDays: 10 }),
    ).toBeNull();
    expect(
      savingsGoalProgress({ goalCents: 0, savedCents: 25000, remainingDays: 10 }),
    ).toBeNull();
  });

  it("calcula o progresso com guardado zero", () => {
    expect(
      savingsGoalProgress({ goalCents: 100000, savedCents: 0, remainingDays: 10 }),
    ).toEqual({
      goalCents: 100000,
      savedCents: 0,
      remainingCents: 100000,
      dailyRemainingCents: 10000,
      percent: 0,
      achieved: false,
    });
  });

  it("calcula o progresso com guardado parcial", () => {
    expect(
      savingsGoalProgress({ goalCents: 100000, savedCents: 25000, remainingDays: 10 }),
    ).toEqual({
      goalCents: 100000,
      savedCents: 25000,
      remainingCents: 75000,
      dailyRemainingCents: 7500,
      percent: 25,
      achieved: false,
    });
  });

  it("calcula o progresso a partir do guardado realizado", () => {
    expect(
      savingsGoalProgress({ goalCents: 100000, savedCents: 50000, remainingDays: 20 }),
    ).toEqual({
      goalCents: 100000,
      savedCents: 50000,
      remainingCents: 50000,
      dailyRemainingCents: 2500,
      percent: 50,
      achieved: false,
    });
  });

  it("arredonda o valor diário restante para cima", () => {
    const progress = savingsGoalProgress({
      goalCents: 100000,
      savedCents: 25000,
      remainingDays: 7,
    });
    expect(progress?.remainingCents).toBe(75000);
    expect(progress?.dailyRemainingCents).toBe(10715);
  });

  it("marca meta atingida quando o guardado é igual à meta", () => {
    expect(
      savingsGoalProgress({ goalCents: 100000, savedCents: 100000, remainingDays: 10 }),
    ).toEqual({
      goalCents: 100000,
      savedCents: 100000,
      remainingCents: 0,
      dailyRemainingCents: 0,
      percent: 100,
      achieved: true,
    });
  });

  it("limita o percentual a 100 quando o guardado supera a meta", () => {
    const progress = savingsGoalProgress({
      goalCents: 100000,
      savedCents: 150000,
      remainingDays: 5,
    });
    expect(progress).toEqual({
      goalCents: 100000,
      savedCents: 150000,
      remainingCents: 0,
      dailyRemainingCents: 0,
      percent: 100,
      achieved: true,
    });
  });

  it("com zero dias restantes mostra o restante integral", () => {
    const progress = savingsGoalProgress({
      goalCents: 100000,
      savedCents: 25000,
      remainingDays: 0,
    });
    expect(progress?.dailyRemainingCents).toBe(75000);
    expect(Number.isFinite(progress?.dailyRemainingCents)).toBe(true);
  });

  it("nunca deixa o guardado negativo", () => {
    const progress = savingsGoalProgress({
      goalCents: 100000,
      savedCents: -5000,
      remainingDays: 10,
    });
    expect(progress?.savedCents).toBe(0);
    expect(progress?.percent).toBe(0);
    expect(progress?.remainingCents).toBe(100000);
  });
});
