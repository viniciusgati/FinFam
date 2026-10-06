import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { SESSION_COOKIE, signSession } from "@/lib/session";
import { middleware } from "./middleware";

const SECRET = "segredo-de-teste-suficientemente-longo";
const originalSecret = process.env.FINFAM_SESSION_SECRET;

function requestFor(path: string, token?: string): NextRequest {
  const headers = new Headers();
  if (token !== undefined) {
    headers.set("cookie", `${SESSION_COOKIE}=${token}`);
  }
  return new NextRequest(new URL(path, "http://localhost:3000"), { headers });
}

beforeEach(() => {
  process.env.FINFAM_SESSION_SECRET = SECRET;
});

afterEach(() => {
  if (originalSecret === undefined) {
    delete process.env.FINFAM_SESSION_SECRET;
  } else {
    process.env.FINFAM_SESSION_SECRET = originalSecret;
  }
});

describe("middleware", () => {
  it("redireciona 302 para /login em rota protegida sem cookie", async () => {
    const response = await middleware(requestFor("/dashboard"));

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/login",
    );
  });

  it("retorna 401 JSON em /api/* sem cookie", async () => {
    const response = await middleware(requestFor("/api/incomes"));

    expect(response.status).toBe(401);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(await response.json()).toEqual({ error: "Não autenticado" });
  });

  it("libera /login sem cookie (rota pública)", async () => {
    const response = await middleware(requestFor("/login"));

    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("libera /api/auth/login sem cookie (rota pública)", async () => {
    const response = await middleware(requestFor("/api/auth/login"));

    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("libera rota protegida com cookie válido", async () => {
    const token = await signSession("familia");
    const response = await middleware(requestFor("/dashboard", token));

    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("libera rota de API com cookie válido", async () => {
    const token = await signSession("familia");
    const response = await middleware(requestFor("/api/incomes", token));

    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("redireciona rota protegida com cookie inválido", async () => {
    const response = await middleware(requestFor("/dashboard", "token-invalido"));

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/login",
    );
  });

  it("retorna 401 em rota de API com cookie inválido", async () => {
    const response = await middleware(
      requestFor("/api/incomes", "token-invalido"),
    );

    expect(response.status).toBe(401);
  });
});
