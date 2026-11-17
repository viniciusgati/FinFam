import { describe, expect, it } from "vitest";
import {
  ACCEPTANCE_AUTH_ENV_VARS,
  MISSING_DATABASE_URL_MESSAGE,
  acceptanceAuthEnvPresence,
  formatAcceptanceAuthEnv,
  maskDatabaseUrl,
  resolveAcceptanceDatabaseUrl,
} from "./acceptance-env";

const TEST_URL = "postgresql://postgres:postgres@localhost:5432/finfam_test";
const DEV_URL = "postgresql://postgres:postgres@localhost:5432/finfam";

describe("resolveAcceptanceDatabaseUrl", () => {
  it("prefere TEST_DATABASE_URL sobre DATABASE_URL", () => {
    expect(
      resolveAcceptanceDatabaseUrl({
        TEST_DATABASE_URL: TEST_URL,
        DATABASE_URL: DEV_URL,
      }),
    ).toEqual({ url: TEST_URL, source: "TEST_DATABASE_URL" });
  });

  it("cai para DATABASE_URL quando TEST_DATABASE_URL está ausente", () => {
    expect(resolveAcceptanceDatabaseUrl({ DATABASE_URL: DEV_URL })).toEqual({
      url: DEV_URL,
      source: "DATABASE_URL",
    });
  });

  it("trata string vazia ou só espaços como ausente e usa o fallback", () => {
    expect(
      resolveAcceptanceDatabaseUrl({
        TEST_DATABASE_URL: "   ",
        DATABASE_URL: DEV_URL,
      }),
    ).toEqual({ url: DEV_URL, source: "DATABASE_URL" });
  });

  it("remove espaços em volta da URL escolhida", () => {
    expect(
      resolveAcceptanceDatabaseUrl({ TEST_DATABASE_URL: `  ${TEST_URL}  ` }),
    ).toEqual({ url: TEST_URL, source: "TEST_DATABASE_URL" });
  });

  it("falha com mensagem clara quando nenhuma variável de banco existe", () => {
    expect(() => resolveAcceptanceDatabaseUrl({})).toThrow(
      MISSING_DATABASE_URL_MESSAGE,
    );
    expect(() =>
      resolveAcceptanceDatabaseUrl({
        TEST_DATABASE_URL: " ",
        DATABASE_URL: "",
      }),
    ).toThrow(MISSING_DATABASE_URL_MESSAGE);
  });
});

describe("maskDatabaseUrl", () => {
  it("esconde a senha do userinfo sem perder host, porta e schema", () => {
    expect(maskDatabaseUrl(`${TEST_URL}?schema=public`)).toBe(
      "postgresql://postgres:***@localhost:5432/finfam_test?schema=public",
    );
  });

  it("esconde senha passada na query string", () => {
    const masked = maskDatabaseUrl(
      "postgresql://postgres@localhost:5432/finfam_test?password=segredo&schema=public",
    );

    expect(masked).not.toContain("segredo");
    expect(masked).toContain("password=***");
    expect(masked).toContain("schema=public");
  });

  it("não ecoa o valor bruto quando a URL é inválida", () => {
    expect(maskDatabaseUrl("não é uma url")).toBe("<DATABASE_URL inválida>");
  });
});

describe("presença das variáveis de autenticação", () => {
  it("descreve apenas definida/ausente, sem vazar valores", () => {
    const env = {
      FINFAM_USER: "familia",
      FINFAM_PASS: "",
      FINFAM_SESSION_SECRET: "segredo-bem-longo",
    };

    expect(acceptanceAuthEnvPresence(env)).toEqual([
      { name: "FINFAM_USER", present: true },
      { name: "FINFAM_PASS", present: false },
      { name: "FINFAM_SESSION_SECRET", present: true },
    ]);
    const summary = formatAcceptanceAuthEnv(acceptanceAuthEnvPresence(env));
    expect(summary).toBe(
      "FINFAM_USER=definida, FINFAM_PASS=ausente, FINFAM_SESSION_SECRET=definida",
    );
    expect(summary).not.toContain("familia");
    expect(summary).not.toContain("segredo-bem-longo");
  });

  it("cobre exatamente as variáveis de autenticação esperadas", () => {
    for (const name of ACCEPTANCE_AUTH_ENV_VARS) {
      expect(formatAcceptanceAuthEnv([{ name, present: true }])).toBe(
        `${name}=definida`,
      );
    }
  });
});
