import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import ReserveSnapshotForm from "./ReserveSnapshotForm";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

function render(currentAmountCents: number | null): string {
  return renderToStaticMarkup(
    createElement(ReserveSnapshotForm, {
      monthKey: "2026-11",
      currentAmountCents,
    }),
  ).replace(/\u00a0/g, " ");
}

describe("ReserveSnapshotForm", () => {
  it("mostra o campo e o botão para confirmar o saldo", () => {
    const html = render(null);

    expect(html).toContain("Saldo guardado (R$)");
    expect(html).toContain("Salvar saldo");
    expect(html).not.toContain("Saldo confirmado");
  });

  it("pré-preenche o último saldo confirmado", () => {
    const html = render(160000);
    expect(html).toContain('value="1.600,00"');
  });

  it("pré-preenche zero quando a família confirmou que não tem reserva", () => {
    const html = render(0);
    expect(html).toContain('value="0,00"');
  });
});
