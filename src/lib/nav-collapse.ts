/**
 * Regras puras do trilho de navegação colapsável (≥768px).
 *
 * Nenhum efeito de UI aqui: o componente `AppNav` combina estas funções com
 * um timer de 5000ms; os testes cobrem apenas esta lógica.
 */

/** Milissemundos sem interação antes de o menu colapsar sozinho. */
export const NAV_AUTO_COLLAPSE_MS = 5000;

/** Chave de persistência do estado "fixado" no `localStorage`. */
export const NAV_PINNED_STORAGE_KEY = "finfam.nav.pinned";

export interface NavCollapseState {
  /** Menu fixado (impede o colapso automático). */
  pinned: boolean;
  /** Timestamp da última interação (hover/foco/clique) no menu. */
  lastInteractionAt: number;
}

/** Registra uma interação em `now`, reiniciando a contagem do auto-colapso. */
export function touchNav(
  state: NavCollapseState,
  now: number,
): NavCollapseState {
  return { ...state, lastInteractionAt: now };
}

/** Verdadeiro quando passou do limite sem interação (ignora `pinned`). */
export function isNavIdle(state: NavCollapseState, now: number): boolean {
  return now - state.lastInteractionAt >= NAV_AUTO_COLLAPSE_MS;
}

/** O menu deve estar expandido em `now`? Fixado ou ainda "quentinho" ⇒ sim. */
export function navExpanded(state: NavCollapseState, now: number): boolean {
  return state.pinned || !isNavIdle(state, now);
}

/**
 * Lê `finfam.nav.pinned` do `localStorage`. Retorna `false` em SSR,
 * incognito ou qualquer ambiente sem `localStorage` — sem lançar exceção.
 */
export function readNavPinned(): boolean {
  try {
    if (typeof localStorage === "undefined") return false;
    return localStorage.getItem(NAV_PINNED_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

/**
 * Grava `finfam.nav.pinned` ("true"/"false"). Silencioso quando o
 * `localStorage` não está disponível (SSR/incognito).
 */
export function writeNavPinned(pinned: boolean): void {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(NAV_PINNED_STORAGE_KEY, pinned ? "true" : "false");
  } catch {
    // Preferência não persistida; o estado em memória continua válido.
  }
}
