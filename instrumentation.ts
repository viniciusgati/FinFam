import { validateEnv } from "@/lib/env";

/**
 * Validação de configuração no boot (hook `register()` do Next 15).
 *
 * Emite uma única linha de erro em pt-BR quando faltam variáveis obrigatórias,
 * mas nunca lança: o processo continua de pé e a tela de login responde 503
 * com a mensagem acionável.
 */
export async function register(): Promise<void> {
  const missing = validateEnv(process.env);
  if (missing.length > 0) {
    console.error(`Configuração ausente: ${missing.join(", ")}`);
  }
}
