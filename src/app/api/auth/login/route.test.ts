import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { POST } from "./route";

const originalEnv = { ...process.env };

const ENV_KEYS = [
  "DATABASE_URL",
  "FINFAM_USER",
  "FINFAM_PASS",
  "FINFAM_SESSION_SECRET",
] as const;

const completeEnv = {
  DATABASE_URL: "postgresql://localhost/finfam",
  FINFAM_USER: "familia",
  FINFAM_PASS: "segredo",
  FINFAM_SESSION_SECRET: "um-segredo-bem-longo",
};

function loginRequest(body: unknown): Request {
  return new Request("http://localhost/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  Object.assign(process.env, completeEnv);
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    const value = originalEnv[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("POST /api/auth/login", () => {
  it("autentica com credenciais corretas e define o cookie", async () => {
    const response = await POST(
      loginRequest({ user: "familia", pass: "segredo" }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(response.cookies.get("finfam_session")?.value).toBeTruthy();
  });

  it("responde 401 para senha errada com env completa", async () => {
    const response = await POST(
      loginRequest({ user: "familia", pass: "errada" }),
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: "Usuário ou senha inválidos",
    });
  });

  it("responde 400 para body inválido", async () => {
    const response = await POST(loginRequest({ user: "", pass: "" }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Dados inválidos" });
  });

  it.each(["FINFAM_USER", "FINFAM_PASS", "FINFAM_SESSION_SECRET"] as const)(
    "responde 503 acionável quando falta %s",
    async (missing) => {
      delete process.env[missing];

      const response = await POST(
        loginRequest({ user: "familia", pass: "segredo" }),
      );
      const json = await response.json();

      expect(response.status).toBe(503);
      expect(json.code).toBe("CONFIG_ERROR");
      expect(json.error.startsWith("Serviço indisponível:")).toBe(true);
      expect(json.error).toContain(missing);
      expect(json.error.endsWith("Avise quem administra o FinFam.")).toBe(true);
    },
  );
});
