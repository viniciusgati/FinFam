import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getCookie } = vi.hoisted(() => ({ getCookie: vi.fn() }));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ get: getCookie })),
}));

import { getSession, verifyCredentials } from "./auth";
import { SESSION_COOKIE, signSession } from "./session";

const SECRET = "segredo-de-teste-suficientemente-longo";
const USER = "familia";
const PASS = "senha-secreta";

const originalEnv = {
  user: process.env.FINFAM_USER,
  pass: process.env.FINFAM_PASS,
  secret: process.env.FINFAM_SESSION_SECRET,
};

function restoreEnv(name: keyof typeof originalEnv, value: string | undefined) {
  const map = {
    user: "FINFAM_USER",
    pass: "FINFAM_PASS",
    secret: "FINFAM_SESSION_SECRET",
  } as const;
  const key = map[name];
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}

afterEach(() => {
  restoreEnv("user", originalEnv.user);
  restoreEnv("pass", originalEnv.pass);
  restoreEnv("secret", originalEnv.secret);
  getCookie.mockReset();
});

describe("verifyCredentials", () => {
  it("aceita as credenciais corretas", () => {
    process.env.FINFAM_USER = USER;
    process.env.FINFAM_PASS = PASS;

    expect(verifyCredentials(USER, PASS)).toBe(true);
  });

  it("rejeita usuário ou senha incorretos", () => {
    process.env.FINFAM_USER = USER;
    process.env.FINFAM_PASS = PASS;

    expect(verifyCredentials("outro", PASS)).toBe(false);
    expect(verifyCredentials(USER, "errada")).toBe(false);
  });

  it("rejeita quando as variáveis de ambiente não estão configuradas", () => {
    delete process.env.FINFAM_USER;
    delete process.env.FINFAM_PASS;

    expect(verifyCredentials(USER, PASS)).toBe(false);

    process.env.FINFAM_USER = USER;
    delete process.env.FINFAM_PASS;

    expect(verifyCredentials(USER, PASS)).toBe(false);
  });
});

describe("getSession", () => {
  beforeEach(() => {
    process.env.FINFAM_SESSION_SECRET = SECRET;
  });

  it("devolve a sessão quando o cookie é válido", async () => {
    const token = await signSession(USER);
    getCookie.mockReturnValue({ value: token });

    expect(await getSession()).toEqual({ user: USER });
    expect(getCookie).toHaveBeenCalledWith(SESSION_COOKIE);
  });

  it("devolve null quando não há cookie de sessão", async () => {
    getCookie.mockReturnValue(undefined);

    expect(await getSession()).toBeNull();
  });

  it("devolve null quando o cookie é inválido", async () => {
    getCookie.mockReturnValue({ value: "token-invalido" });

    expect(await getSession()).toBeNull();
  });
});
