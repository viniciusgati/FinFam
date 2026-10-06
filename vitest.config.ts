import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    environment: "node",
    // `npm test` roda apenas testes unitários: o glob `!(...)` mantém os
    // arquivos `*.integration.test.ts` fora da suíte padrão. As suítes de
    // integração rodam via `npm run test:integration`, que usa
    // `vitest.integration.config.ts`.
    include: ["src/**/!(*.integration).test.ts"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
