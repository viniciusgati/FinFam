import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import QuickExpenseCard from "./QuickExpenseCard";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

function render(): string {
  return renderToStaticMarkup(createElement(QuickExpenseCard)).replace(
    /\u00a0/g,
    " ",
  );
}

describe("QuickExpenseCard (renderização)", () => {
  it("informa que o lançamento rápido já nasce marcado como pago", () => {
    const html = render();
    expect(html).toContain("Este lançamento já nasce marcado como pago.");
  });
});
