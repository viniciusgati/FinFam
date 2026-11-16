/**
 * Persistência da preferência de menu expandido/recolhido (≥768px).
 *
 * O estado só muda por ação explícita do usuário (botão de recolher/expandir).
 * Nenhum efeito de UI aqui: `AppNav` consome estas funções.
 */

/** Chave de persistência do estado expandido no `localStorage`. */
export const NAV_EXPANDED_STORAGE_KEY = "finfam.nav.expanded";

/**
 * Lê `finfam.nav.expanded` do `localStorage`. O menu inicia expandido, então
 * ausência de valor, SSR, incognito ou qualquer erro resultam em `true` —
 * sem lançar exceção.
 */
export function readNavExpanded(): boolean {
  try {
    if (typeof localStorage === "undefined") return true;
    return localStorage.getItem(NAV_EXPANDED_STORAGE_KEY) !== "false";
  } catch {
    return true;
  }
}

/**
 * Grava `finfam.nav.expanded` ("true"/"false"). Silencioso quando o
 * `localStorage` não está disponível (SSR/incognito) ou lança erro.
 */
export function writeNavExpanded(expanded: boolean): void {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(NAV_EXPANDED_STORAGE_KEY, expanded ? "true" : "false");
  } catch {
    // Preferência não persistida; o estado em memória continua válido.
  }
}
