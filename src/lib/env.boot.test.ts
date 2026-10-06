import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { register } from "../../instrumentation";

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

beforeEach(() => {
  Object.assign(process.env, completeEnv);
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    const value = originalEnv[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  vi.restoreAllMocks();
});

describe("register", () => {
  it("não emite erro quando a configuração está completa", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await register();

    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("emite uma única linha nomeando a variável ausente, sem lançar", async () => {
    delete process.env.FINFAM_PASS;
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(register()).resolves.toBeUndefined();

    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy.mock.calls[0][0]).toBe("Configuração ausente: FINFAM_PASS");
  });

  it("lista todas as ausentes separadas por vírgula", async () => {
    delete process.env.FINFAM_USER;
    delete process.env.FINFAM_PASS;
    delete process.env.FINFAM_SESSION_SECRET;
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await register();

    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy.mock.calls[0][0]).toBe(
      "Configuração ausente: FINFAM_USER, FINFAM_PASS, FINFAM_SESSION_SECRET",
    );
  });
});
