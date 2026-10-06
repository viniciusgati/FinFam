import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { SESSION_COOKIE, verifySession } from "@/lib/session";
import {
  disconnectTestDatabase,
  requireTestDatabase,
  resetDatabase,
} from "@/test/integration";
import { POST } from "./route";

// Falha de forma explícita sem `TEST_DATABASE_URL`; nunca toca SQLite.
requireTestDatabase();

const USER = "familia";
const PASS = "senha-de-teste";
const SECRET = "segredo-de-teste-suficientemente-longo";

const originalEnv = {
  user: process.env.FINFAM_USER,
  pass: process.env.FINFAM_PASS,
  secret: process.env.FINFAM_SESSION_SECRET,
};

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/login — integração", () => {
  beforeAll(() => {
    process.env.FINFAM_USER = USER;
    process.env.FINFAM_PASS = PASS;
    process.env.FINFAM_SESSION_SECRET = SECRET;
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    process.env.FINFAM_USER = originalEnv.user;
    process.env.FINFAM_PASS = originalEnv.pass;
    process.env.FINFAM_SESSION_SECRET = originalEnv.secret;
    await disconnectTestDatabase();
  });

  it("retorna 200 e seta o cookie de sessão com credenciais válidas", async () => {
    const response = await POST(jsonRequest({ user: USER, pass: PASS }));

    expect(response.status).toBe(200);

    const setCookie = response.headers.get("set-cookie");
    expect(setCookie).toContain(`${SESSION_COOKIE}=`);

    const token = response.cookies.get(SESSION_COOKIE)?.value;
    expect(token).toBeTruthy();
    expect(await verifySession(token)).toEqual({ user: USER });
  });

  it("retorna 401 e não seta cookie com credenciais inválidas", async () => {
    const response = await POST(jsonRequest({ user: USER, pass: "errada" }));

    expect(response.status).toBe(401);
    expect(response.cookies.get(SESSION_COOKIE)).toBeUndefined();
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("retorna 400 e não seta cookie com payload inválido", async () => {
    const response = await POST(jsonRequest({ user: "", pass: "" }));

    expect(response.status).toBe(400);
    expect(response.cookies.get(SESSION_COOKIE)).toBeUndefined();
  });
});
