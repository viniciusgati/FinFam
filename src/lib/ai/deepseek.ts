/**
 * Cliente mínimo da API da DeepSeek (compatível com a da OpenAI).
 *
 * A chave é lida apenas de `DEEPSEEK_API_KEY` e nunca é logada. URL e modelo são
 * configuráveis por `DEEPSEEK_API_URL`/`DEEPSEEK_MODEL`. Sem chave, a IA é
 * considerada indisponível — as rotas caem no fallback determinístico local.
 */

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface DeepSeekConfig {
  apiKey: string;
  apiUrl: string;
  model: string;
}

export const DEFAULT_DEEPSEEK_API_URL =
  "https://api.deepseek.com/chat/completions";
export const DEFAULT_DEEPSEEK_MODEL = "deepseek-chat";

type EnvRecord = Record<string, string | undefined>;

/** Lançado quando não há chave configurada (nada deve ir à rede). */
export class AiUnavailableError extends Error {
  constructor() {
    super("ai_unavailable");
    this.name = "AiUnavailableError";
  }
}

/** Config efetiva da DeepSeek, ou `null` quando a chave está ausente/vazia. */
export function resolveDeepSeekConfig(
  env: EnvRecord = process.env,
): DeepSeekConfig | null {
  const apiKey = env.DEEPSEEK_API_KEY?.trim();
  if (!apiKey) return null;
  return {
    apiKey,
    apiUrl: env.DEEPSEEK_API_URL?.trim() || DEFAULT_DEEPSEEK_API_URL,
    model: env.DEEPSEEK_MODEL?.trim() || DEFAULT_DEEPSEEK_MODEL,
  };
}

export function isAiConfigured(env: EnvRecord = process.env): boolean {
  return resolveDeepSeekConfig(env) !== null;
}

export interface ChatCompletionOptions {
  env?: EnvRecord;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  signal?: AbortSignal;
}

interface ChatCompletionResponse {
  choices?: { message?: { content?: string } }[];
}

/**
 * Envia as mensagens à DeepSeek e devolve o texto da resposta.
 *
 * Usa `AbortController` para impor um timeout (default 3s, alinhado ao
 * requisito de ~3s do simulador). Lança `AiUnavailableError` sem chave e
 * `Error` em respostas não-2xx ou sem conteúdo.
 */
export async function chatCompletion(
  messages: ChatMessage[],
  options: ChatCompletionOptions = {},
): Promise<string> {
  const config = resolveDeepSeekConfig(options.env);
  if (!config) throw new AiUnavailableError();

  const fetchImpl = options.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? 3000,
  );

  const onExternalAbort = () => controller.abort();
  options.signal?.addEventListener("abort", onExternalAbort);

  try {
    const response = await fetchImpl(config.apiUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({ model: config.model, messages, temperature: 0.2 }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`DeepSeek respondeu ${response.status}`);
    }

    const data = (await response.json()) as ChatCompletionResponse;
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) throw new Error("Resposta vazia da DeepSeek");
    return content;
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener("abort", onExternalAbort);
  }
}
