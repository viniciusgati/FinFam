// Service worker mínimo do FinFam.
// Estratégia atual: sem cache agressivo (dados financeiros mudam sempre).
// Mantém apenas o básico para permitir a instalação como PWA.
// TODO: adicionar cache offline do app shell em fase futura.

const CACHE_NAME = "finfam-v1";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", () => {
  // Network-first implícito: não interceptamos as requisições.
});
