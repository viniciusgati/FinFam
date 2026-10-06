/**
 * Validação de configuração por variáveis de ambiente.
 *
 * Pura e sem efeitos colaterais: recebe o `env` e devolve os nomes ausentes,
 * na ordem de `REQUIRED_ENV`. String vazia ou só espaços conta como ausente.
 */

export const REQUIRED_ENV = [
  "DATABASE_URL",
  "FINFAM_USER",
  "FINFAM_PASS",
  "FINFAM_SESSION_SECRET",
] as const;

/** Variáveis necessárias apenas para autenticar (login/sessão). */
export const AUTH_ENV_VARS = [
  "FINFAM_USER",
  "FINFAM_PASS",
  "FINFAM_SESSION_SECRET",
] as const;

type EnvRecord = Record<string, string | undefined>;

function isMissing(value: string | undefined): boolean {
  return value === undefined || value.trim() === "";
}

/** Nomes de `REQUIRED_ENV` ausentes/vazios em `env`. */
export function validateEnv(env: EnvRecord): string[] {
  return REQUIRED_ENV.filter((name) => isMissing(env[name]));
}
