import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Sob testes, as suítes de integração usam um PostgreSQL dedicado apontado por
// TEST_DATABASE_URL (nunca SQLite); fora de testes a conexão segue DATABASE_URL.
const testDatabaseUrl =
  process.env.NODE_ENV === "test" ? process.env.TEST_DATABASE_URL : undefined;

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    ...(testDatabaseUrl
      ? { datasources: { db: { url: testDatabaseUrl } } }
      : {}),
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
