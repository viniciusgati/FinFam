import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "finfam_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export interface SessionPayload {
  user: string;
}

function getSecret(): Uint8Array {
  const secret = process.env.FINFAM_SESSION_SECRET;
  if (!secret) {
    throw new Error("FINFAM_SESSION_SECRET não definido");
  }
  return new TextEncoder().encode(secret);
}

export async function signSession(
  user: string,
  maxAgeSeconds: number = SESSION_MAX_AGE_SECONDS,
): Promise<string> {
  return new SignJWT({ user })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${maxAgeSeconds}s`)
    .sign(getSecret());
}

export async function verifySession(
  token: string | undefined | null,
): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (typeof payload.user !== "string") return null;
    return { user: payload.user };
  } catch {
    return null;
  }
}
