import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  FAMILY_EMPTY_TEXT,
  FAMILY_INCOME_SHORTFALL_TEXT,
  FAMILY_POSITIVE_MARKER,
  FAMILY_POSITIVE_TEXT,
  FAMILY_WARNING_MARKER,
  type FamilyInsight,
} from "@/lib/family-insights";
import FamilyHelpCard from "./FamilyHelpCard";

function render(
  insights: FamilyInsight[],
  overrides: Partial<{ fallback: string; monthKey: string }> = {},
): string {
  return renderToStaticMarkup(
    createElement(FamilyHelpCard, {
      insights,
      fallback: "Fallback local",
      monthKey: "2026-10",
      ...overrides,
    }),
  ).replace(/\u00a0/g, " ");
}

const warning: FamilyInsight = {
  id: "income-shortfall",
  tone: "warning",
  marker: FAMILY_WARNING_MARKER,
  text: FAMILY_INCOME_SHORTFALL_TEXT,
};

const positive: FamilyInsight = {
  id: "positive",
  tone: "positive",
  marker: FAMILY_POSITIVE_MARKER,
  text: FAMILY_POSITIVE_TEXT,
};

const neutral: FamilyInsight = {
  id: "neutral",
  tone: "neutral",
  marker: null,
  text: FAMILY_EMPTY_TEXT,
};

describe("FamilyHelpCard (markup estático)", () => {
  it("renderiza o título e o botão de IA habilitado no estado ocioso", () => {
    const html = render([warning]);

    expect(html).toContain("Ajuda à família");
    expect(html).toContain("Gerar resumo da IA");
    expect(html).not.toContain('disabled=""');
    expect(html).not.toContain("Gerando resumo com IA…");
  });

  it("mantém o texto do insight visível e mostra o marcador de atenção", () => {
    const html = render([warning]);

    expect(html).toContain(FAMILY_WARNING_MARKER);
    expect(html).toContain(FAMILY_INCOME_SHORTFALL_TEXT);
  });

  it("mostra o marcador positivo com o texto correspondente", () => {
    const html = render([positive]);

    expect(html).toContain(FAMILY_POSITIVE_MARKER);
    expect(html).toContain(FAMILY_POSITIVE_TEXT);
  });

  it("não mostra marcador no tom neutro, mas mantém o texto", () => {
    const html = render([neutral]);

    expect(html).not.toContain(FAMILY_WARNING_MARKER);
    expect(html).not.toContain(FAMILY_POSITIVE_MARKER);
    expect(html).toContain(FAMILY_EMPTY_TEXT);
  });

  it("com lista de insights vazia exibe exatamente o vazio fixado", () => {
    const html = render([]);

    expect(html).toContain(FAMILY_EMPTY_TEXT);
  });

  it("não renderiza spinner: o card determinístico é montado no servidor", () => {
    const html = render([positive]);

    expect(html).not.toContain("Gerando resumo com IA…");
    expect(html).not.toContain('role="status"');
  });
});
