import { cookies } from "next/headers";
import { timingSafeEqual } from "node:crypto";
import {
  SESSION_COOKIE,
  verifySession,
  type SessionPayload,
} from "./session";

function safeEqual(a: string, b: string): boolean {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
}

/**
 * Valida as credenciais contra as variáveis de ambiente FINFAM_USER e
 * FINFAM_PASS. Retorna false quando as variáveis não estão configuradas.
 */
export function verifyCredentials(user: string, pass: string): boolean {
  const expectedUser = process.env.FINFAM_USER;
  const expectedPass = process.env.FINFAM_PASS;
  if (!expectedUser || !expectedPass) return false;
  return safeEqual(user, expectedUser) && safeEqual(pass, expectedPass);
}

export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  return verifySession(store.get(SESSION_COOKIE)?.value);
}

export { SESSION_COOKIE };
