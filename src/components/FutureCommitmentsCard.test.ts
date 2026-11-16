import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { FutureCommitmentMonth } from "@/lib/future-commitments";
import type { UpcomingBill, UpcomingEndingSoon } from "@/lib/upcoming";
import FutureCommitmentsCard from "./FutureCommitmentsCard";

function render(
  props: Partial<Parameters<typeof FutureCommitmentsCard>[0]> = {},
): string {
  return renderToStaticMarkup(
    createElement(FutureCommitmentsCard, {
      months: [],
      bills: [],
      endingSoon: [],
      ...props,
    }),
  ).replace(/\u00a0/g, " ");
}

const months: FutureCommitmentMonth[] = [
  { monthKey: "2026-12", totalCents: 10000, cards: [] },
  { monthKey: "2027-01", totalCents: 5000, cards: [] },
  { monthKey: "2027-02", totalCents: 0, cards: [] },
];

const bills: UpcomingBill[] = [
  { name: "Aluguel", dueDate: "2026-11-30", amountCents: 150000 },
];

const endingSoon: UpcomingEndingSoon[] = [
  { name: "Streaming", endMonth: "2027-01" },
];

describe("FutureCommitmentsCard (renderização)", () => {
  it("mostra os totais por mês com rótulo e valor formatado", () => {
    const html = render({ months, bills, endingSoon });

    expect(html).toContain("Compromissos futuros");
    expect(html).toContain("dezembro de 2026");
    expect(html).toContain("R$ 100,00");
    expect(html).toContain("janeiro de 2027");
    expect(html).toContain("R$ 50,00");
    expect(html).toContain("fevereiro de 2027");
    expect(html).toContain("R$ 0,00");
  });

  it("lista os vencimentos na ordem recebida, com nome, dd/mm e valor", () => {
    const html = render({ months, bills, endingSoon });

    expect(html).toContain("Aluguel — 30/11 — R$ 1.500,00");
    expect(html.indexOf("Aluguel")).toBeLessThan(html.indexOf("Termina em"));
  });

  it("mostra os avisos de término com o texto de endingSoonLabel", () => {
    const html = render({ months, bills, endingSoon });

    expect(html).toContain("Termina em janeiro de 2027");
  });

  it("expõe os links para detalhar /cartoes e /saidas", () => {
    const html = render({ months, bills, endingSoon });

    expect(html).toContain('href="/cartoes"');
    expect(html).toContain('href="/saidas"');
  });

  it("sem meses, vencimentos ou avisos mostra o estado vazio e mantém os links", () => {
    const html = render({
      months: [
        { monthKey: "2026-12", totalCents: 0, cards: [] },
        { monthKey: "2027-01", totalCents: 0, cards: [] },
        { monthKey: "2027-02", totalCents: 0, cards: [] },
      ],
    });

    expect(html).toContain("Nenhum compromisso futuro nos próximos 3 meses.");
    expect(html).toContain('href="/cartoes"');
    expect(html).toContain('href="/saidas"');
    expect(html).not.toContain("R$");
    expect(html).not.toContain("dezembro de 2026");
    expect(html).not.toContain("Vencimentos do ciclo");
  });

  it("considera vazio também quando a lista de meses não vem preenchida", () => {
    const html = render();

    expect(html).toContain("Nenhum compromisso futuro nos próximos 3 meses.");
    expect(html).not.toContain("Vencimentos do ciclo");
  });
});
