import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import LoginPage from "./page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

function renderLogin(): string {
  return renderToStaticMarkup(createElement(LoginPage));
}

describe("LoginPage (semântica e rotulagem)", () => {
  it("associa rótulo e id/name aos campos de usuário e senha (acessibilidade #373)", () => {
    const html = renderLogin();

    expect(html).toMatch(/<label[^>]*>.*Usuário.*<input[^>]*id="login-user"[^>]*name="user"/s);
    expect(html).toMatch(/<label[^>]*>.*Senha.*<input[^>]*id="login-pass"[^>]*name="pass"/s);
  });

  it("mantém o botão de entrar com nome acessível", () => {
    const html = renderLogin();

    expect(html).toMatch(/<button[^>]*type="submit"[^>]*>Entrar<\/button>/);
  });
});
