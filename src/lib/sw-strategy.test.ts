import { describe, expect, it } from "vitest";
import {
  isApiRequest,
  isAuthRequest,
  isNeverCacheRequest,
  isStaticAsset,
  strategyFor,
} from "./sw-strategy";

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
