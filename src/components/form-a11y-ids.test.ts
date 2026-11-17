import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import CreditCardsManager from "./CreditCardsManager";
import ExtraIncomesManager from "./ExtraIncomesManager";
import FixedItemsManager from "./FixedItemsManager";
import GastosManager from "./GastosManager";
import { InvoiceImportBody } from "./InvoiceImportPanel";
import PurchaseSimulator from "./PurchaseSimulator";
import QuickCardAdjustmentCard from "./QuickCardAdjustmentCard";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
}));

const MONTH_OPTIONS = [
  { value: "2026-11", label: "novembro de 2026" },
  { value: "2026-10", label: "outubro de 2026" },
];

function assertFields(html: string, pairs: Array<[string, string]>) {
  for (const [id, name] of pairs) {
    expect(html).toMatch(
      new RegExp(`<[a-z]+[^>]*id="${id}"[^>]*name="${name}"`),
    );
  }
}

describe("formulários principais expõem id/name (regressão #373: campos sem id/name)", () => {
  it("todo campo de /gastos (filtros e formulário) tem id e name", () => {
    const html = renderToStaticMarkup(
      createElement(GastosManager, {
        mes: "2026-11",
        today: "2026-11-17",
        currentMes: "2026-11",
        monthOptions: MONTH_OPTIONS,
        initialExpenses: [],
        categorySuggestions: [],
      }),
    );

    assertFields(html, [
      ["gastos-month", "month"],
      ["gastos-filter-search", "search"],
      ["gastos-filter-category", "category"],
      ["gastos-filter-payment", "payment"],
      ["gastos-filter-status", "status"],
      ["gasto-description", "description"],
      ["gasto-amount", "amount"],
      ["gasto-date", "date"],
      ["gasto-category", "category"],
      ["gasto-payment", "paymentMethod"],
      ["gasto-paid", "paid"],
    ]);
  });

  it("todo campo de /entradas tem id e name", () => {
    const html = renderToStaticMarkup(
      createElement(ExtraIncomesManager, {
        mes: "2026-11",
        today: "2026-11-17",
        currentMes: "2026-11",
        monthOptions: MONTH_OPTIONS,
        initialIncomes: [],
      }),
    );

    assertFields(html, [
      ["extra-income-month", "month"],
      ["extra-income-description", "description"],
      ["extra-income-amount", "amount"],
      ["extra-income-date", "date"],
    ]);
  });

  it("todo campo das saídas fixas tem id e name", () => {
    const html = renderToStaticMarkup(
      createElement(FixedItemsManager, {
        endpoint: "/api/fixed-expenses",
        title: "Saídas fixas",
        dayField: "dueDay",
        dayLabel: "Dia de vencimento",
        dayVerb: "vence",
        showCategory: true,
        emptyMessage: "Nenhuma saída fixa cadastrada.",
        ctaLabel: "Adicionar saída fixa",
        savedMessage: "Saída fixa salva",
        deactivatedMessage: "Saída fixa desativada",
        reactivatedMessage: "Saída fixa reativada",
        fallbackErrorMessage: "Não foi possível salvar.",
        initialItems: [],
      }),
    );

    assertFields(html, [
      ["fixed-item-name", "name"],
      ["fixed-item-amount", "amount"],
      ["fixed-item-day", "dueDay"],
      ["fixed-item-category", "category"],
      ["fixed-item-start-month", "startMonth"],
      ["fixed-item-end-month", "endMonth"],
    ]);
  });

  it("todo campo de /cartoes (cartão, compra e ajuste) tem id e name", () => {
    const html = renderToStaticMarkup(
      createElement(CreditCardsManager, {
        initialCards: [],
        initialPurchases: [],
        referenceMonthKey: "2026-11",
      }),
    );

    assertFields(html, [
      ["card-name", "name"],
      ["card-limit", "limit"],
      ["card-closing-day", "closingDay"],
      ["card-due-day", "dueDay"],
      ["card-purchase-card", "cardId"],
      ["card-purchase-description", "description"],
      ["card-purchase-amount", "amount"],
      ["card-purchase-date", "purchaseDate"],
      ["card-purchase-installment", "installmentNumber"],
      ["card-purchase-installments", "installmentsTotal"],
      ["card-purchase-category", "category"],
      ["card-adjustment-card", "cardId"],
      ["card-adjustment-target", "target"],
    ]);
  });

  it("os campos do simulador de compra têm id e name", () => {
    const html = renderToStaticMarkup(
      createElement(PurchaseSimulator, {
        freeBudgetCents: 500000,
        dailyCents: 20000,
        remainingDays: 25,
        usualDailySpendCents: 24960,
      }),
    );

    assertFields(html, [
      ["purchase-simulator-value", "value"],
      ["purchase-simulator-installments", "installments"],
    ]);
  });

  it("os campos da importação de fatura têm id e name", () => {
    const html = renderToStaticMarkup(
      createElement(InvoiceImportBody, {
        cards: [{ id: "card-1", name: "Nubank" }],
        cardId: "",
        hasFile: false,
        busy: null,
        preview: null,
        status: null,
        error: null,
        onCardChange: vi.fn(),
        onFileChange: vi.fn(),
        onPreview: vi.fn(),
        onConfirm: vi.fn(),
      }),
    );

    assertFields(html, [
      ["invoice-import-card", "cardId"],
      ["invoice-import-file", "file"],
    ]);
  });

  it("os campos do ajuste rápido do cartão têm id e name", () => {
    const html = renderToStaticMarkup(
      createElement(QuickCardAdjustmentCard, {
        cards: [{ id: "card-1", name: "Nubank" }],
        totalsByCard: { "card-1": 0 },
        monthKey: "2026-11",
      }),
    );

    assertFields(html, [
      ["quick-card-adjustment-card", "cardId"],
      ["quick-card-adjustment-total", "total"],
    ]);
  });
});
