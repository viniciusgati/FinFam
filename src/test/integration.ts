import { PrismaClient } from "@prisma/client";

/**
 * Infraestrutura das suítes de integração (`*.integration.test.ts`).
 *
 * As suítes usam um PostgreSQL **dedicado de teste** apontado por
 * `TEST_DATABASE_URL` — nunca SQLite. Quando a variável não está definida, o
 * arquivo `*.integration.test.ts` falha de forma explícita ao chamar
 * `requireTestDatabase()`; o `npm test` padrão nem inclui esses arquivos
 * (ver `vitest.config.ts`), então permanece verde offline.
 */
export const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;

/** `true` quando existe um banco de teste configurado no ambiente. */
export const hasTestDatabase = Boolean(TEST_DATABASE_URL);

export const MISSING_TEST_DATABASE_MESSAGE =
  "TEST_DATABASE_URL não está definida. Defina-a apontando para um PostgreSQL " +
  "dedicado de teste para rodar as suítes de integração " +
  "(ex.: TEST_DATABASE_URL=postgresql://user:pass@host:5432/finfam_test " +
  "npm run test:integration). SQLite não é suportado.";

/**
 * Garante que há um banco de teste configurado e devolve a URL. Lança um erro
 * com mensagem explícita (nunca pula em silêncio) para que
 * `npm run test:integration` sem `TEST_DATABASE_URL` falhe.
 */
export function requireTestDatabase(): string {
  if (!TEST_DATABASE_URL) {
    throw new Error(MISSING_TEST_DATABASE_MESSAGE);
  }
  return TEST_DATABASE_URL;
}

// Faz o singleton de `@/lib/db` (e qualquer PrismaClient criado depois deste
// módulo) enxergar o banco de teste, mesmo que `DATABASE_URL` aponte para o
// banco de desenvolvimento.
if (TEST_DATABASE_URL) {
  process.env.DATABASE_URL = TEST_DATABASE_URL;
}

let testPrisma: PrismaClient | undefined;

/** Cliente Prisma conectado ao PostgreSQL de teste (criado sob demanda). */
export function getTestPrisma(): PrismaClient {
  const url = requireTestDatabase();
  if (!testPrisma) {
    testPrisma = new PrismaClient({ datasources: { db: { url } } });
  }
  return testPrisma;
}

/**
 * Tabelas de domínio, das dependentes para as independentes. O `CASCADE` do
 * PostgreSQL cobre as FKs restantes.
 */
const TABLES = [
  "app_settings",
  "card_purchases",
  "variable_expenses",
  "variable_incomes",
  "monthly_snapshots",
  "credit_cards",
  "incomes",
  "fixed_expenses",
] as const;

/**
 * Limpa todas as tabelas de domínio entre casos de teste, reiniciando as
 * sequências. Chamar em `beforeEach` garante isolamento entre os testes.
 */
export async function resetDatabase(): Promise<void> {
  const prisma = getTestPrisma();
  const tables = TABLES.map((table) => `"${table}"`).join(", ");
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${tables} RESTART IDENTITY CASCADE`,
  );
}

/** Alias semântico de {@link resetDatabase} para leitura dos testes. */
export const truncateAllTables = resetDatabase;

/** Encerra o cliente de teste (chamar em `afterAll`). */
export async function disconnectTestDatabase(): Promise<void> {
  if (!testPrisma) return;
  await testPrisma.$disconnect();
  testPrisma = undefined;
}
