import { afterEach, describe, expect, it } from "vitest";
import { signSession, verifySession } from "./session";

const SECRET = "segredo-de-teste-suficientemente-longo";
const OTHER_SECRET = "outro-segredo-igualmente-longo-de-teste";

const originalSecret = process.env.FINFAM_SESSION_SECRET;

afterEach(() => {
  if (originalSecret === undefined) {
    delete process.env.FINFAM_SESSION_SECRET;
  } else {
    process.env.FINFAM_SESSION_SECRET = originalSecret;
  }
});

describe("signSession / verifySession", () => {
  it("faz round-trip do usuário", async () => {
    process.env.FINFAM_SESSION_SECRET = SECRET;

    const token = await signSession("familia");

    expect(typeof token).toBe("string");
    expect(await verifySession(token)).toEqual({ user: "familia" });
  });

  it("retorna null quando o segredo é diferente do usado na assinatura", async () => {
    process.env.FINFAM_SESSION_SECRET = OTHER_SECRET;
    const token = await signSession("familia");

    process.env.FINFAM_SESSION_SECRET = SECRET;

    expect(await verifySession(token)).toBeNull();
  });

  it("retorna null para token expirado (maxAgeSeconds negativo)", async () => {
    process.env.FINFAM_SESSION_SECRET = SECRET;

    const token = await signSession("familia", -1);

    expect(await verifySession(token)).toBeNull();
  });

  it("retorna null para token adulterado", async () => {
    process.env.FINFAM_SESSION_SECRET = SECRET;
    const token = await signSession("familia");
    const [header, , signature] = token.split(".");
    const payloadAdulterado = Buffer.from(
      JSON.stringify({ user: "intruso" }),
    ).toString("base64url");

    const tampered = `${header}.${payloadAdulterado}.${signature}`;

    expect(await verifySession(tampered)).toBeNull();
  });

  it("retorna null quando a assinatura é alterada", async () => {
    process.env.FINFAM_SESSION_SECRET = SECRET;
    const token = await signSession("familia");
    const lastChar = token.at(-1);
    const trocado = lastChar === "a" ? "b" : "a";

    expect(await verifySession(`${token.slice(0, -1)}${trocado}`)).toBeNull();
  });

  it("retorna null para token ausente ou vazio", async () => {
    process.env.FINFAM_SESSION_SECRET = SECRET;

    expect(await verifySession(undefined)).toBeNull();
    expect(await verifySession(null)).toBeNull();
    expect(await verifySession("")).toBeNull();
  });

  it("lança ao assinar sem FINFAM_SESSION_SECRET", async () => {
    delete process.env.FINFAM_SESSION_SECRET;

    await expect(signSession("familia")).rejects.toThrow(
      "FINFAM_SESSION_SECRET",
    );
  });

  it("retorna null ao verificar sem FINFAM_SESSION_SECRET", async () => {
    process.env.FINFAM_SESSION_SECRET = SECRET;
    const token = await signSession("familia");

    delete process.env.FINFAM_SESSION_SECRET;

    expect(await verifySession(token)).toBeNull();
  });
});
