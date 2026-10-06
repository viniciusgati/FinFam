import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyCredentials } from "@/lib/auth";
import { AUTH_ENV_VARS, validateEnv } from "@/lib/env";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  signSession,
} from "@/lib/session";

export const runtime = "nodejs";

const authEnvNames = new Set<string>(AUTH_ENV_VARS);

const loginSchema = z.object({
  user: z.string().min(1),
  pass: z.string().min(1),
});

export async function POST(request: Request): Promise<NextResponse> {
  const body = await request.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }

  const missingAuth = validateEnv(process.env).filter((name) =>
    authEnvNames.has(name),
  );
  if (missingAuth.length > 0) {
    return NextResponse.json(
      {
        error: `Serviço indisponível: falta configurar ${missingAuth.join(
          ", ",
        )}. Avise quem administra o FinFam.`,
        code: "CONFIG_ERROR",
      },
      { status: 503 },
    );
  }

  if (!verifyCredentials(parsed.data.user, parsed.data.pass)) {
    return NextResponse.json(
      { error: "Usuário ou senha inválidos" },
      { status: 401 },
    );
  }

  const token = await signSession(parsed.data.user);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });

  return response;
}
