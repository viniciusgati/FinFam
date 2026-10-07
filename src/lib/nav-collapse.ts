/** Tempo de inatividade, em ms, após o qual o menu lateral recolhe sozinho. */
export const NAV_AUTO_COLLAPSE_MS = 10_000;

/** Chave do `localStorage` onde a preferência expandido/recolhido é salva. */
export const NAV_EXPANDED_STORAGE_KEY = "finfam:nav-expanded";

/**
 * Indica se o menu lateral deve recolher por inatividade.
 *
 * `lastInteractionAt` e `now` são timestamps em ms (ex.: `Date.now()`); o
 * recolhimento ocorre quando o tempo desde a última interação atinge o timeout.
 */
export function shouldAutoCollapse(
  lastInteractionAt: number,
  now: number,
  timeoutMs: number = NAV_AUTO_COLLAPSE_MS,
): boolean {
  return now - lastInteractionAt >= timeoutMs;
}

/**
 * Estado inicial do menu quando não há preferência salva: recolhido em viewports
 * de tablet (768–1023px) e expandido nas demais.
 */
export function defaultNavExpanded(isTabletViewport: boolean): boolean {
  return !isTabletViewport;
}

/** Converte a preferência persistida em `boolean` (`null` se ausente/inválida). */
export function parseStoredExpanded(value: string | null): boolean | null {
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
}
