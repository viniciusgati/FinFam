/**
 * Decisão de estratégia de cache do service worker.
 *
 * Módulo puro e testável; `public/sw.js` é servido estático e não passa por
 * bundling, por isso replica a mesma predicação inline. A regra é:
 * - dados e autenticação (`/api/*`, `/api/auth/*`, login/logout): `network-first`
 *   e **nunca** gravados em cache;
 * - navegação e assets estáticos do app shell (`/_next/static/*`, CSS, fontes,
 *   ícones): `cache-first` do shell.
 */
export type SwStrategy = "network-first" | "cache-first";

/**
 * Teto de entradas do cache runtime (assets do app preenchidos sob demanda).
 * A ordem de `Cache.keys()` é a de inserção; ao exceder o teto removemos as
 * entradas mais antigas. O precache do shell (`finfam-shell-*`) é separado e
 * não é afetado por este limite.
 */
export const MAX_RUNTIME_CACHE_ENTRIES = 60;
export const RUNTIME_CACHE_LIMIT = MAX_RUNTIME_CACHE_ENTRIES;

/**
 * Retorna as chaves excedentes (as mais antigas) que devem sair do cache
 * runtime para respeitar `max` entradas. Não muta a entrada.
 */
export function excessRuntimeCacheKeys(
  keys: readonly string[],
  max: number = MAX_RUNTIME_CACHE_ENTRIES,
): string[] {
  return keys.slice(0, Math.max(0, keys.length - max));
}

const AUTH_PATHNAMES = new Set([
  "/api/auth",
  "/api/auth/login",
  "/api/auth/logout",
  "/api/login",
  "/api/logout",
]);

function pathnameOf(url: string): string {
  try {
    return new URL(url, "http://localhost").pathname;
  } catch {
    return url;
  }
}

export function isApiRequest(url: string): boolean {
  const pathname = pathnameOf(url);
  return pathname === "/api" || pathname.startsWith("/api/");
}

export function isAuthRequest(url: string): boolean {
  const pathname = pathnameOf(url);
  return pathname.startsWith("/api/auth/") || AUTH_PATHNAMES.has(pathname);
}

export function isNeverCacheRequest(url: string): boolean {
  return isApiRequest(url) || isAuthRequest(url);
}

export function isStaticAsset(url: string): boolean {
  const pathname = pathnameOf(url);
  return (
    pathname.startsWith("/_next/static/") ||
    pathname.startsWith("/icons/") ||
    /\.(?:css|js|mjs|woff2?|png|svg|ico|webp)$/.test(pathname)
  );
}

export function strategyFor(url: string): SwStrategy {
  return isNeverCacheRequest(url) ? "network-first" : "cache-first";
}
