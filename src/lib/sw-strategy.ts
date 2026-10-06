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
