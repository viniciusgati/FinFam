import { describe, expect, it } from "vitest";
import {
  excessRuntimeCacheKeys,
  isApiRequest,
  isAuthRequest,
  isNeverCacheRequest,
  isStaticAsset,
  MAX_RUNTIME_CACHE_ENTRIES,
  RUNTIME_CACHE_LIMIT,
  strategyFor,
} from "./sw-strategy";

function keys(count: number): string[] {
  return Array.from({ length: count }, (_, index) => `/chunk-${index}.js`);
}

describe("cache runtime do service worker", () => {
  it("limita o cache runtime a 60 entradas", () => {
    expect(MAX_RUNTIME_CACHE_ENTRIES).toBe(60);
    expect(RUNTIME_CACHE_LIMIT).toBe(MAX_RUNTIME_CACHE_ENTRIES);
  });

  it("não remove nada quando está dentro do teto", () => {
    expect(excessRuntimeCacheKeys([], 60)).toEqual([]);
    expect(excessRuntimeCacheKeys(keys(60), 60)).toEqual([]);
    expect(excessRuntimeCacheKeys(keys(59), 60)).toEqual([]);
  });

  it("remove as entradas mais antigas quando passa do teto", () => {
    expect(excessRuntimeCacheKeys(keys(61), 60)).toEqual(["/chunk-0.js"]);
    expect(excessRuntimeCacheKeys(keys(65), 60)).toEqual([
      "/chunk-0.js",
      "/chunk-1.js",
      "/chunk-2.js",
      "/chunk-3.js",
      "/chunk-4.js",
    ]);
    expect(excessRuntimeCacheKeys(keys(65))).toHaveLength(5);
  });

  it("com limite 0 remove todas as entradas", () => {
    const all = keys(3);
    expect(excessRuntimeCacheKeys(all, 0)).toEqual(all);
  });

  it("não muta a lista de entrada", () => {
    const input = keys(65);
    const snapshot = [...input];
    excessRuntimeCacheKeys(input, 60);
    expect(input).toEqual(snapshot);
  });
});

describe("isApiRequest", () => {
  it("reconhece a raiz /api e suas subrotas", () => {
    expect(isApiRequest("/api")).toBe(true);
    expect(isApiRequest("/api/incomes")).toBe(true);
    expect(isApiRequest("/api/auth/login")).toBe(true);
  });

  it("não confunde outras rotas com a API", () => {
    expect(isApiRequest("/")).toBe(false);
    expect(isApiRequest("/apiario")).toBe(false);
    expect(isApiRequest("/offline")).toBe(false);
  });
});

describe("isAuthRequest", () => {
  it("reconhece os endpoints de autenticação", () => {
    expect(isAuthRequest("/api/auth/login")).toBe(true);
    expect(isAuthRequest("/api/auth/logout")).toBe(true);
    expect(isAuthRequest("/api/auth")).toBe(true);
    expect(isAuthRequest("/api/login")).toBe(true);
    expect(isAuthRequest("/api/logout")).toBe(true);
  });

  it("não marca rotas comuns de navegação como auth", () => {
    expect(isAuthRequest("/login")).toBe(false);
    expect(isAuthRequest("/api/incomes")).toBe(false);
  });
});

describe("strategyFor", () => {
  it("usa network-first para dados e autenticação, sem cache", () => {
    for (const url of [
      "/api/incomes",
      "/api/incomes/42",
      "/api/auth/login",
      "/api/auth/logout",
    ]) {
      expect(strategyFor(url)).toBe("network-first");
      expect(isNeverCacheRequest(url)).toBe(true);
    }
  });

  it("usa cache-first para navegação", () => {
    expect(strategyFor("/")).toBe("cache-first");
    expect(strategyFor("/entradas")).toBe("cache-first");
    expect(strategyFor("/offline")).toBe("cache-first");
  });

  it("usa cache-first para assets estáticos do shell", () => {
    for (const url of [
      "/_next/static/chunks/main.js",
      "/_next/static/css/app.css",
      "/icons/icon-192.png",
      "/icons/icon-512-maskable.png",
      "/manifest.webmanifest",
    ]) {
      expect(strategyFor(url)).toBe("cache-first");
      expect(isNeverCacheRequest(url)).toBe(false);
    }
  });
});

describe("isStaticAsset", () => {
  it("reconhece estáticos do Next, ícones e folhas de estilo", () => {
    expect(isStaticAsset("/_next/static/chunks/app.js")).toBe(true);
    expect(isStaticAsset("/icons/apple-touch-icon.png")).toBe(true);
    expect(isStaticAsset("/styles/globals.css")).toBe(true);
    expect(isStaticAsset("/fonts/inter.woff2")).toBe(true);
  });

  it("não trata documentos ou dados como estáticos", () => {
    expect(isStaticAsset("/")).toBe(false);
    expect(isStaticAsset("/entradas")).toBe(false);
    expect(isStaticAsset("/api/incomes")).toBe(false);
  });
});
