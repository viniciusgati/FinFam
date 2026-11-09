/**
 * Zonas de decisão do dashboard (história #361).
 *
 * Organiza os blocos existentes em quatro zonas com títulos, prioridades e
 * ordem canônica fixos. A função é pura: não acessa banco, rede nem
 * `Date.now()`; o chamador informa o estado de cada bloco disponível.
 *
 * Regras:
 * - Cada bloco pertence a exatamente uma zona (mapeamento abaixo).
 * - Blocos em `error` saem das zonas e vão para `failed`, na ordem canônica.
 * - Blocos `empty` e `future` permanecem na sua zona com o estado preservado
 *   (a página decide o que exibir nesses estados).
 * - Uma zona só aparece se tiver ao menos um bloco fora de `error`.
 * - Ids duplicados são deduplicados mantendo a primeira ocorrência; ids
 *   desconhecidos são ignorados.
 */

export type DashboardBlockId =
  | "month-spend"
  | "spend-advice"
  | "quick-expense"
  | "daily-allowance"
  | "purchase-simulator"
  | "income-allocation"
  | "daily-consumption"
  | "category-breakdown"
  | "family-help"
  | "month-review";

export type DashboardBlockState = "ok" | "error" | "empty" | "future";

export type DashboardZoneId = "summary" | "actions" | "commitments" | "explore";

export interface DashboardBlock {
  id: DashboardBlockId;
  state: DashboardBlockState;
}

export interface DashboardZone {
  id: DashboardZoneId;
  title: string;
  priority: number;
  blocks: DashboardBlock[];
}

export interface DashboardLayout {
  zones: DashboardZone[];
  failed: DashboardBlockId[];
}

interface ZoneDefinition {
  id: DashboardZoneId;
  title: string;
  priority: number;
  blocks: readonly DashboardBlockId[];
}

const ZONE_DEFINITIONS: readonly ZoneDefinition[] = [
  {
    id: "summary",
    title: "Resumo do ciclo",
    priority: 1,
    blocks: ["month-spend", "spend-advice"],
  },
  {
    id: "actions",
    title: "Ações",
    priority: 2,
    blocks: ["quick-expense", "daily-allowance", "purchase-simulator"],
  },
  {
    id: "commitments",
    title: "Compromissos",
    priority: 3,
    blocks: ["income-allocation", "daily-consumption", "category-breakdown"],
  },
  {
    id: "explore",
    title: "Explorar",
    priority: 4,
    blocks: ["family-help", "month-review"],
  },
];

const ZONE_BY_BLOCK = new Map<DashboardBlockId, DashboardZoneId>(
  ZONE_DEFINITIONS.flatMap((zone) =>
    zone.blocks.map((id) => [id, zone.id] as const),
  ),
);

function isKnownBlock(id: string): id is DashboardBlockId {
  return ZONE_BY_BLOCK.has(id as DashboardBlockId);
}

export function buildDashboardLayout(
  blocks: readonly DashboardBlock[],
): DashboardLayout {
  const stateById = new Map<DashboardBlockId, DashboardBlockState>();

  for (const block of blocks) {
    if (!isKnownBlock(block.id)) continue;
    // Mantém a primeira ocorrência de cada id.
    if (!stateById.has(block.id)) stateById.set(block.id, block.state);
  }

  const zones: DashboardZone[] = [];
  const failed: DashboardBlockId[] = [];

  for (const zone of ZONE_DEFINITIONS) {
    const zoneBlocks: DashboardBlock[] = [];

    for (const id of zone.blocks) {
      const state = stateById.get(id);
      if (state === undefined) continue;

      if (state === "error") {
        failed.push(id);
        continue;
      }

      zoneBlocks.push({ id, state });
    }

    if (zoneBlocks.length > 0) {
      zones.push({
        id: zone.id,
        title: zone.title,
        priority: zone.priority,
        blocks: zoneBlocks,
      });
    }
  }

  return { zones, failed };
}
