import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Configuração das suítes de integração: mesmo ambiente/alias do
// `vitest.config.ts`, porém coletando apenas `*.integration.test.ts`.
export default defineConfig({
  // Componentes JSX usam o runtime automático do React (igual ao Next.js).
  esbuild: { jsx: "automatic" },
  test: {
    environment: "node",
    include: ["src/**/*.integration.test.ts"],
    // As suítes compartilham o mesmo PostgreSQL de teste e limpam as tabelas
    // entre casos; rodar os arquivos em série evita que um `TRUNCATE` de um
    // arquivo apague dados que outro ainda está usando.
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
