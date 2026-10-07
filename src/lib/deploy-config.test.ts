import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Guarda a configuração de deploy no Railway: o PostgreSQL é acessado
 * exclusivamente por `DATABASE_URL` (injetada pela vinculação do serviço) e as
 * migrations rodam no start, nunca no build — a rede privada
 * (`*.railway.internal`) só existe em runtime.
 */

function readRepoFile(relativePath: string): string {
  return readFileSync(
    fileURLToPath(new URL(relativePath, import.meta.url)),
    "utf8",
  );
}

interface RailwayConfig {
  build?: Record<string, unknown>;
  deploy?: {
    startCommand?: string;
    restartPolicy?: unknown;
    restartPolicyType?: string;
  };
}

describe("deploy no Railway — PostgreSQL via DATABASE_URL", () => {
  it("usa DATABASE_URL no Prisma, sem host embutido", () => {
    const schema = readRepoFile("../../prisma/schema.prisma");

    expect(schema).toMatch(/provider\s*=\s*"postgresql"/);
    expect(schema).toMatch(/url\s*=\s*env\("DATABASE_URL"\)/);
    expect(schema).not.toContain("localhost");
    expect(schema).not.toContain("postgres.railway.internal");
  });

  it("roda as migrations no start, sob um shell, e nunca no build", () => {
    const railway = JSON.parse(
      readRepoFile("../../railway.json"),
    ) as RailwayConfig;

    expect(railway.build).not.toHaveProperty("command");

    const startCommand = railway.deploy?.startCommand ?? "";
    expect(startCommand).toContain("/bin/sh -c");
    expect(startCommand).toContain("npx prisma migrate deploy");
    expect(startCommand).toContain("npm run start");
    expect(startCommand.indexOf("npx prisma migrate deploy")).toBeLessThan(
      startCommand.indexOf("npm run start"),
    );

    expect(railway.deploy).not.toHaveProperty("restartPolicy");
    expect(railway.deploy?.restartPolicyType).toBe("ON_FAILURE");
  });
});
