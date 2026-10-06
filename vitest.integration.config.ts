import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Configuração das suítes de integração: mesmo ambiente/alias do
// `vitest.config.ts`, porém coletando apenas `*.integration.test.ts`.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.integration.test.ts"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
