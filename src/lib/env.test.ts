import { describe, expect, it } from "vitest";
import { AUTH_ENV_VARS, REQUIRED_ENV, validateEnv } from "./env";

const complete = {
  DATABASE_URL: "postgresql://localhost/finfam",
  FINFAM_USER: "familia",
  FINFAM_PASS: "segredo",
  FINFAM_SESSION_SECRET: "um-segredo-bem-longo",
};

describe("validateEnv", () => {
  it("retorna [] com todas as variáveis preenchidas", () => {
    expect(validateEnv(complete)).toEqual([]);
  });

  it("aponta apenas a variável ausente", () => {
    const { FINFAM_SESSION_SECRET: _omitted, ...withoutSecret } = complete;
    expect(validateEnv(withoutSecret)).toEqual(["FINFAM_SESSION_SECRET"]);
  });

  it("trata string vazia ou só espaços como ausente", () => {
    expect(validateEnv({ ...complete, FINFAM_USER: "   " })).toEqual([
      "FINFAM_USER",
    ]);
    expect(validateEnv({ ...complete, FINFAM_PASS: "" })).toEqual([
      "FINFAM_PASS",
    ]);
  });

  it("preserva a ordem de REQUIRED_ENV com múltiplas ausências", () => {
    expect(validateEnv({ DATABASE_URL: "x" })).toEqual([
      "FINFAM_USER",
      "FINFAM_PASS",
      "FINFAM_SESSION_SECRET",
    ]);
  });
});

describe("constantes", () => {
  it("AUTH_ENV_VARS é subconjunto de REQUIRED_ENV", () => {
    for (const name of AUTH_ENV_VARS) {
      expect(REQUIRED_ENV).toContain(name);
    }
  });
});
