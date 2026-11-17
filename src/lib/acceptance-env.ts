/**
 * Resolução de ambiente do aceite ponta a ponta.
 *
 * Funções puras (sem efeitos colaterais) usadas por
 * `scripts/acceptance-env.ts` para escolher o banco de aceite e descrever as
 * variáveis presentes **sem nunca imprimir valores sensíveis**.
 */

export type AcceptanceEnv = Record<string, string | undefined>;

/** Ordem de preferência do banco de aceite: teste primeiro, dev como fallback. */
export const ACCEPTANCE_DB_ENV_VARS = [
  "TEST_DATABASE_URL",
  "DATABASE_URL",
] as const;

/** Variáveis necessárias para autenticar no roteiro. */
export const ACCEPTANCE_AUTH_ENV_VARS = [
  "FINFAM_USER",
  "FINFAM_PASS",
  "FINFAM_SESSION_SECRET",
] as const;

export type AcceptanceDbEnvVar = (typeof ACCEPTANCE_DB_ENV_VARS)[number];

export interface DatabaseUrlResolution {
  url: string;
  source: AcceptanceDbEnvVar;
}

export const MISSING_DATABASE_URL_MESSAGE =
  "Nem TEST_DATABASE_URL nem DATABASE_URL está definida. " +
  "Defina TEST_DATABASE_URL (preferencial) ou DATABASE_URL apontando para o " +
  "PostgreSQL de aceite e rode de novo.";

function isSet(value: string | undefined): value is string {
  return typeof value === "string" && value.trim() !== "";
}

/**
 * Banco de aceite: `TEST_DATABASE_URL` quando preenchida; senão
 * `DATABASE_URL`. String vazia ou só espaços conta como ausente. Lança erro
 * com mensagem explícita quando nenhuma das duas está configurada.
 */
export function resolveAcceptanceDatabaseUrl(
  env: AcceptanceEnv,
): DatabaseUrlResolution {
  for (const name of ACCEPTANCE_DB_ENV_VARS) {
    const value = env[name];
    if (isSet(value)) return { url: value.trim(), source: name };
  }
  throw new Error(MISSING_DATABASE_URL_MESSAGE);
}

/**
 * Versão segura da URL para log: esconde a senha (do userinfo e de
 * `?password=`/`?pwd=`). Uma URL inválida vira um marcador fixo, para nunca
 * ecoar o valor bruto.
 */
export function maskDatabaseUrl(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return "<DATABASE_URL inválida>";
  }

  if (url.password) url.password = "***";
  for (const key of ["password", "pass", "pwd"]) {
    if (url.searchParams.has(key)) url.searchParams.set(key, "***");
  }
  return url.toString();
}

export interface EnvPresence {
  name: string;
  present: boolean;
}

/** Presença das variáveis de autenticação, sem expor os valores. */
export function acceptanceAuthEnvPresence(env: AcceptanceEnv): EnvPresence[] {
  return ACCEPTANCE_AUTH_ENV_VARS.map((name) => ({
    name,
    present: isSet(env[name]),
  }));
}

/**
 * Resumo de uma linha no formato `FINFAM_USER=definida, FINFAM_PASS=ausente`
 * — apenas o estado, nunca o conteúdo.
 */
export function formatAcceptanceAuthEnv(presence: EnvPresence[]): string {
  return presence
    .map(({ name, present }) => `${name}=${present ? "definida" : "ausente"}`)
    .join(", ");
}
