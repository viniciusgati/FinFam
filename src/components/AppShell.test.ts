import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import AppShell from "./AppShell";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/",
}));

// `children` é passado como argumento adicional (regra react/no-children-prop);
// o cast torna a propriedade opcional para casar com `AppShellProps`.
const Shell = AppShell as unknown as (props: {
  user: string;
  children?: ReactNode;
}) => ReactNode;

function render(): string {
  return renderToStaticMarkup(
    createElement(Shell, { user: "Ana" }, "conteúdo"),
  );
}

describe("AppShell (markup estático)", () => {
  it("layout horizontal a partir de md e main com padding total", () => {
    const html = render();

    expect(html).toContain("md:flex-row");
    expect(html).not.toContain("lg:flex-row");
    expect(html).toContain("p-4 sm:p-6 lg:p-8");
  });
});
