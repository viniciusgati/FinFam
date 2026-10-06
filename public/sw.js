// Service worker do FinFam: cache do app shell e fallback offline.
//
// Estratégia:
// - install: precacheia o app shell (o documento "/offline", manifest e
//   ícones) — o documento "/" não é precacheado para que, sem rede, a
//   navegação caia no fallback /offline em vez de servir dados antigos;
// - activate: remove caches de versões anteriores;
// - fetch: cache-first para navegação e assets estáticos, com fallback para o
//   documento "/offline" precacheado; network-first SEM cache para dados e
//   autenticação (/api/*, /api/auth/*) — nunca são gravados em cache.
//
// É JavaScript plano servido estaticamente (sem bundling): a predicação repete
// inline a regra de src/lib/sw-strategy.ts, coberta por testes unitários.

const CACHE_NAME = "finfam-shell-v2";
const OFFLINE_URL = "/offline";

const PRECACHE_URLS = [
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-192-maskable.png",
  "/icons/icon-512-maskable.png",
  "/icons/apple-touch-icon.png",
];

const NEXT_STATIC_ASSET_RE = /(?:src|href)="(\/_next\/static\/[^"]+)"/g;

// --- Replica inline de src/lib/sw-strategy.ts -------------------------------

function isApiPath(pathname) {
  return pathname === "/api" || pathname.startsWith("/api/");
}

function isAuthPath(pathname) {
  return (
    pathname === "/api/auth" ||
    pathname.startsWith("/api/auth/") ||
    pathname === "/api/login" ||
    pathname === "/api/logout"
  );
}

function isNeverCachePath(pathname) {
  return isApiPath(pathname) || isAuthPath(pathname);
}

function isStaticAssetPath(pathname) {
  return (
    pathname.startsWith("/_next/static/") ||
    pathname.startsWith("/icons/") ||
    /\.(?:css|js|mjs|woff2?|png|svg|ico|webp)$/.test(pathname)
  );
}

// --- Instalação -------------------------------------------------------------

async function precache(url) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(url, { cache: "reload" });
    if (response.ok) {
      await cache.put(url, response);
    }
  } catch {
    // Falha em um recurso isolado não deve abortar a instalação do shell.
  }
}

// Precacheia o documento /offline e os chunks do Next que ele referencia, para
// que a tela offline e seu botão "Tentar novamente" funcionem sem rede.
async function precacheOfflinePage() {
  const cache = await caches.open(CACHE_NAME);
  let html;
  try {
    const response = await fetch(OFFLINE_URL, { cache: "reload" });
    if (!response.ok) return;
    html = await response.clone().text();
    await cache.put(OFFLINE_URL, response);
  } catch {
    return;
  }

  const assets = new Set();
  let match;
  while ((match = NEXT_STATIC_ASSET_RE.exec(html)) !== null) {
    assets.add(match[1]);
  }
  await Promise.all([...assets].map((url) => precache(url)));
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      await Promise.all(PRECACHE_URLS.map((url) => precache(url)));
      await precacheOfflinePage();
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

// --- Intercepção de requisições ---------------------------------------------

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  // Sondas de conectividade da página /offline pedem acesso direto à rede.
  if (request.headers.get("x-sw-network-only") === "1") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  const { pathname } = url;

  // Dados e autenticação: network-first, nunca `cache.put`.
  if (isNeverCachePath(pathname)) {
    event.respondWith(fetch(request));
    return;
  }

  // Navegação: cache do shell quando disponível; senão rede; offline → /offline.
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match(request, { ignoreSearch: true });
        if (cached) return cached;
        try {
          return await fetch(request);
        } catch {
          const offline = await cache.match(OFFLINE_URL);
          if (offline) return offline;
          return new Response("Você está offline.", {
            status: 503,
            headers: { "Content-Type": "text/plain; charset=utf-8" },
          });
        }
      })(),
    );
    return;
  }

  // Assets estáticos do shell: cache-first com preenchimento em runtime.
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(request);
      if (cached) return cached;
      try {
        const response = await fetch(request);
        if (response.ok && isStaticAssetPath(pathname)) {
          await cache.put(request, response.clone());
        }
        return response;
      } catch {
        return Response.error();
      }
    })(),
  );
});
