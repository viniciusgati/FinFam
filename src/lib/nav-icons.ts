import type { NavIconName } from "./navigation";

/**
 * Ícones SVG inline da navegação, desenhados no próprio repositório para evitar
 * dependências externas. Cada ícone é uma lista de comandos `d` de `<path>`,
 * renderizada por `NavIcon` sobre um `viewBox` de 24x24 com traço em
 * `currentColor`.
 */
export const NAV_ICONS: Record<NavIconName, readonly string[]> = {
  dashboard: [
    "M3 3h7v7H3z",
    "M14 3h7v7h-7z",
    "M14 14h7v7h-7z",
    "M3 14h7v7H3z",
  ],
  entradas: ["M12 5v14", "M5 12l7 7 7-7"],
  saidas: ["M12 19V5", "M5 12l7-7 7 7"],
  gastos: [
    "M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z",
    "M7 7h.01",
  ],
  cartoes: ["M2 5h20v14H2z", "M2 10h20"],
  historico: ["M12 22a10 10 0 100-20 10 10 0 000 20z", "M12 6v6l4 2"],
  configuracoes: [
    "M12 15a3 3 0 100-6 3 3 0 000 6z",
    "M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z",
  ],
};
