import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  buildDashboardLayout,
  type DashboardBlock,
  type DashboardBlockId,
} from "./dashboard-layout";

/**
 * Guarda o layout do dashboard (história #232, refinada na #233 e revisada):
 * largura total (sem `max-w-4xl`/`mx-auto`), card principal em **largura
 * total** e "Lançamento rápido" lado a lado com "Pode gastar por dia" em
 * viewports `md+` (empilhados abaixo disso).
 */

function readSource(relativePath: string): string {
  return readFileSync(
    fileURLToPath(new URL(relativePath, import.meta.url)),
    "utf8",
  );
}

/** Recorta o bloco `{ ... }` que começa em `start` (chaves balanceadas). */
function jsxBlock(source: string, start: number): string {
  let depth = 0;
  for (let index = start; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    else if (source[index] === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  return source.slice(start);
}

describe("layout do dashboard", () => {
  it("usa largura total, sem max-w nem mx-auto no container", () => {
    const page = readSource("../app/(app)/page.tsx");

    expect(page).toContain('className="flex w-full flex-col gap-6"');
    expect(page).not.toMatch(/max-w-4xl/);
    expect(page).not.toMatch(/mx-auto flex w-full/);
  });

  it("coloca a lista de compras ao lado do card principal em md+", () => {
    const page = readSource("../app/(app)/page.tsx");

    // O hero não usa mais o span de grid do layout antigo.
    expect(page).not.toContain('className={isCalendarMonth ? "" : "md:col-span-2"}');

    const gridStart = page.indexOf("grid gap-6 md:grid-cols-2 items-stretch");
    const month = page.indexOf("{monthSpendCard}", gridStart);
    const shopping = page.indexOf("<ShoppingListCard");
    expect(gridStart).toBeGreaterThanOrEqual(0);
    expect(month).toBeGreaterThan(gridStart);
    expect(shopping).toBeGreaterThan(month);
  });

  it("coloca o lançamento rápido ao lado do Pode gastar por dia", () => {
    const page = readSource("../app/(app)/page.tsx");

    const gridStart = page.indexOf("grid items-stretch gap-6 md:grid-cols-2");
    const gridEnd = page.indexOf("</div>", gridStart);
    const quick = page.indexOf("<QuickExpenseCard");
    const daily = page.indexOf("<DailyAllowanceCard");

    expect(gridStart).toBeGreaterThanOrEqual(0);
    expect(gridEnd).toBeGreaterThan(gridStart);
    expect(quick).toBeGreaterThan(gridStart);
    expect(daily).toBeGreaterThan(quick);
    expect(daily).toBeLessThan(gridEnd);

    const quickBlock = jsxBlock(page, page.indexOf("{isCurrentCycle && ("));
    expect(quickBlock).toContain("<QuickExpenseCard");
  });

  it("renderiza o Pode gastar por dia fora de qualquer bloco isCurrentCycle", () => {
    const page = readSource("../app/(app)/page.tsx");
    const marker = "{isCurrentCycle && (";

    let index = page.indexOf(marker);
    expect(index).toBeGreaterThanOrEqual(0);
    while (index >= 0) {
      expect(jsxBlock(page, index)).not.toContain("<DailyAllowanceCard");
      index = page.indexOf(marker, index + marker.length);
    }

    expect(page).toContain("<DailyAllowanceCard");
  });

  it("mantém o Pode gastar por dia em largura total na prévia de ciclo futuro", () => {
    const page = readSource("../app/(app)/page.tsx");
    const marker = "{(isCurrentCycle || allowance !== null) && (";
    const start = page.indexOf(marker);

    expect(start).toBeGreaterThanOrEqual(0);

    const block = jsxBlock(page, start);
    const normalized = block.replace(/\s+/g, " ");

    // Ciclo corrente: duas colunas. Ciclo futuro: container simples, sem
    // meia coluna, para o card ocupar a largura total do conteúdo.
    expect(normalized).toContain(
      'isCurrentCycle ? "grid items-stretch gap-6 md:grid-cols-2" : "grid gap-6"',
    );
    expect(block).toContain("<DailyAllowanceCard");
    expect(jsxBlock(block, block.indexOf("{isCurrentCycle && ("))).toContain(
      "<QuickExpenseCard",
    );
  });
});

describe("alerta de ritmo único no dashboard", () => {
  it("o MonthSpendCard não declara consumo nem mensagem acionável", () => {
    const card = readSource("../components/MonthSpendCard.tsx");

    expect(card).not.toContain("consumptionLabel");
    expect(card).not.toContain("actionableMessage");
  });

  it("a página calcula e renderiza um único bloco de recomendação", () => {
    const page = readSource("../app/(app)/page.tsx");

    expect(page).toContain("buildSpendAdvice");
    expect(page).toContain("<SpendAdviceCard");
    expect(page.match(/<SpendAdviceCard/g)).toHaveLength(1);
    expect(page).not.toContain("consumptionLabel=");
    expect(page).not.toContain("actionableMessage=");
  });

  it("o IncomeAllocationCard não repete consumo disponível, saldo nem No vermelho", () => {
    const card = readSource("../components/IncomeAllocationCard.tsx");

    expect(card).not.toContain("Consumo disponível");
    expect(card).not.toContain("Saldo do mês");
    expect(card).not.toContain("No vermelho");
  });
});

describe("QuickExpenseCard em colunas estreitas", () => {
  it("empilha os campos antes de lg e usa 4 colunas em lg", () => {
    const card = readSource("../components/QuickExpenseCard.tsx");

    expect(card).toContain('className="grid gap-4 lg:grid-cols-4"');
    expect(card).not.toContain('className="grid gap-4 sm:grid-cols-3"');
    expect(card).not.toContain('className="grid gap-4 lg:grid-cols-3"');
  });

  it("oferece categoria com input list + datalist e sugestões", () => {
    const card = readSource("../components/QuickExpenseCard.tsx");

    expect(card).toContain("categorySuggestions");
    expect(card).toContain("list={CATEGORY_DATALIST_ID}");
    expect(card).toContain("<CategoryDatalist");
    expect(card).toContain("setCategory");
  });
});

describe("layout do histórico (evolução dos meses)", () => {
  it("monta a view a partir de funções puras e consulta a janela de snapshots", () => {
    const page = readSource("../app/(app)/historico/page.tsx");

    expect(page).toContain("historyView");
    expect(page).toContain("loadMonthHistory");
    expect(page).toContain("<MonthSelector");
    expect(page).toContain("isCurrentMonth={isCurrentMonth}");
    expect(page).toContain("isFutureMonth");
  });

  it("renderiza tabela, gráfico e comparativo no componente de apresentação", () => {
    const view = readSource("../components/HistoryView.tsx");

    expect(view).toContain("formatCents");
    expect(view).toContain("Evolução dos meses");
    expect(view).toContain('role="img"');
    expect(view).toContain("comparisonTitle");
    expect(view).toContain("tableHeaders");
  });
});

describe("skeleton de carregamento da rota", () => {
  it("expõe status acessível e o texto Carregando…", () => {
    const skeleton = readSource("../components/DashboardSkeleton.tsx");

    expect(skeleton).toContain('aria-busy="true"');
    expect(skeleton).toContain('role="status"');
    expect(skeleton).toContain('aria-live="polite"');
    expect(skeleton).toContain("Carregando…");
  });

  it("exibe as quatro zonas de decisão na ordem canônica", () => {
    const skeleton = readSource("../components/DashboardSkeleton.tsx");
    const titles = ["Resumo do ciclo", "Ações", "Compromissos", "Explorar"];

    let previous = -1;
    for (const title of titles) {
      const index = skeleton.indexOf(title);
      expect(index).toBeGreaterThan(previous);
      previous = index;
    }

    expect(skeleton.match(/<h2/g)).toHaveLength(titles.length);
    expect(skeleton.match(/animate-pulse/g)?.length).toBeGreaterThanOrEqual(
      titles.length,
    );
  });

  it("o loading.tsx da rota usa o mesmo skeleton", () => {
    const loading = readSource("../app/(app)/loading.tsx");

    expect(loading).toContain("<DashboardSkeleton />");
  });
});

describe("seção Gastos por categoria no dashboard", () => {
  it("renderiza o CategoryBreakdownCard dentro do ramo ok", () => {
    const page = readSource("../app/(app)/page.tsx");

    const okIndex = page.indexOf('view.state === "ok" && series !== null');
    const cardIndex = page.indexOf("<CategoryBreakdownCard");

    expect(okIndex).toBeGreaterThanOrEqual(0);
    expect(cardIndex).toBeGreaterThan(okIndex);
  });

  it("não renderiza a seção no ramo de erro", () => {
    const page = readSource("../app/(app)/page.tsx");

    const errorIndex = page.indexOf('view.state === "error"');
    const emptyIndex = page.indexOf('view.state === "empty"');
    const errorBlock = page.slice(errorIndex, emptyIndex);

    expect(errorIndex).toBeGreaterThanOrEqual(0);
    expect(emptyIndex).toBeGreaterThan(errorIndex);
    expect(errorBlock).not.toContain("CategoryBreakdownCard");
    expect(errorBlock).toContain("<RetryButton");
  });

  it("o skeleton tem a seção Gastos por categoria acessível", () => {
    const skeleton = readSource("../components/DashboardSkeleton.tsx");

    expect(skeleton).toContain("Gastos por categoria");
    expect(skeleton).toContain('aria-busy="true"');
    expect(skeleton).toContain('role="status"');
  });
});

const DASHBOARD_PAGE = "../app/(app)/page.tsx";
const HISTORY_PAGE = "../app/(app)/historico/page.tsx";
const HISTORY_VIEW = "../components/HistoryView.tsx";

describe("feedback de carregamento da navegação do dashboard", () => {
  it("envolve o conteúdo no MonthNavigation (skeleton enquanto isPending)", () => {
    const page = readSource(DASHBOARD_PAGE);

    expect(page).toContain("<MonthNavigation");
    expect(page).toContain("</MonthNavigation>");
    expect(page).not.toContain("<MonthSelector");
  });

  it("exibe o dashboard só depois do skeleton (fora do estado pendente)", () => {
    const view = readSource("../components/MonthNavigation.tsx");

    expect(view).toContain("{isPending ? <DashboardSkeleton /> : children}");
  });
});

describe("estados de navegação e onboarding do ciclo", () => {
  it("pré-visualiza ciclo futuro no dashboard e mantém o aviso no histórico", () => {
    const dashboard = readSource(DASHBOARD_PAGE);
    expect(dashboard).toContain("isFutureCycle");
    expect(dashboard).toContain("<CyclePreviewNotice />");
    expect(dashboard).not.toContain("<FutureMonthNotice />");

    const history = readSource(HISTORY_VIEW);
    expect(history).toContain('view.state === "future"');
    expect(history).toContain("<FutureMonthNotice />");

    expect(readSource(HISTORY_PAGE)).toContain("isFutureMonth");
  });

  it("passa isFutureMonth para o view model de cada página", () => {
    expect(readSource(DASHBOARD_PAGE)).toMatch(
      /dashboardView\(\{[\s\S]*?isFutureMonth/,
    );
    expect(readSource(HISTORY_PAGE)).toMatch(
      /historyView\(\{[\s\S]*?isFutureMonth/,
    );
  });

  it("renderiza o vazio do dashboard por emptyStateCopy(view.reason), sem hardcode de CTA", () => {
    const page = readSource(DASHBOARD_PAGE);

    expect(page).toContain("emptyStateCopy(view.reason)");
    expect(page).not.toContain("Cadastrar entradas");
    expect(page).not.toContain('href="/entradas"');
  });
});

const ALL_DASHBOARD_BLOCKS: DashboardBlock[] = [
  { id: "month-spend", state: "ok" },
  { id: "shopping-list", state: "ok" },
  { id: "spend-advice", state: "ok" },
  { id: "quick-expense", state: "ok" },
  { id: "daily-allowance", state: "ok" },
  { id: "card-adjustment", state: "ok" },
  { id: "income-allocation", state: "ok" },
  { id: "daily-consumption", state: "ok" },
  { id: "category-breakdown", state: "ok" },
  { id: "savings-goal", state: "ok" },
  { id: "future-commitments", state: "ok" },
  { id: "purchase-simulator", state: "ok" },
  { id: "open-expenses", state: "ok" },
  { id: "family-help", state: "ok" },
  { id: "month-review", state: "ok" },
];

describe("zonas de decisão do dashboard", () => {
  it("organiza os 15 blocos ok nas quatro zonas na ordem canônica", () => {
    const { zones, failed } = buildDashboardLayout(ALL_DASHBOARD_BLOCKS);

    expect(failed).toEqual([]);
    expect(zones.map((zone) => zone.id)).toEqual([
      "summary",
      "actions",
      "commitments",
      "explore",
    ]);
    expect(zones.map((zone) => zone.title)).toEqual([
      "Resumo do ciclo",
      "Ações",
      "Compromissos",
      "Explorar",
    ]);
    expect(zones.map((zone) => zone.priority)).toEqual([1, 2, 3, 4]);

    expect(zones[0].blocks).toEqual([
      { id: "month-spend", state: "ok" },
      { id: "shopping-list", state: "ok" },
      { id: "spend-advice", state: "ok" },
    ]);
    expect(zones[1].blocks).toEqual([
      { id: "quick-expense", state: "ok" },
      { id: "daily-allowance", state: "ok" },
      { id: "card-adjustment", state: "ok" },
    ]);
    expect(zones[2].blocks).toEqual([
      { id: "income-allocation", state: "ok" },
      { id: "daily-consumption", state: "ok" },
      { id: "category-breakdown", state: "ok" },
      { id: "savings-goal", state: "ok" },
      { id: "future-commitments", state: "ok" },
      { id: "purchase-simulator", state: "ok" },
      { id: "open-expenses", state: "ok" },
    ]);
    expect(zones[3].blocks).toEqual([
      { id: "family-help", state: "ok" },
      { id: "month-review", state: "ok" },
    ]);
  });

  it("inclui shopping-list na zona summary logo após month-spend", () => {
    const { zones, failed } = buildDashboardLayout([
      { id: "spend-advice", state: "ok" },
      { id: "shopping-list", state: "ok" },
      { id: "month-spend", state: "ok" },
    ]);

    expect(failed).toEqual([]);
    expect(zones[0].id).toBe("summary");
    expect(zones[0].blocks.map((block) => block.id)).toEqual([
      "month-spend",
      "shopping-list",
      "spend-advice",
    ]);
  });

  it("move shopping-list para failed quando a leitura da lista falha", () => {
    const { zones, failed } = buildDashboardLayout([
      { id: "month-spend", state: "ok" },
      { id: "shopping-list", state: "error" },
      { id: "spend-advice", state: "ok" },
    ]);

    expect(failed).toEqual(["shopping-list"]);
    expect(zones[0].blocks.map((block) => block.id)).toEqual([
      "month-spend",
      "spend-advice",
    ]);
  });

  it("remove blocos em error das zonas e os lista em failed", () => {
    const blocks: DashboardBlock[] = ALL_DASHBOARD_BLOCKS.map((block) =>
      block.id === "daily-consumption" || block.id === "family-help"
        ? { ...block, state: "error" as const }
        : block,
    );

    const { zones, failed } = buildDashboardLayout(blocks);

    expect(failed).toEqual(["daily-consumption", "family-help"]);
    expect(zones.map((zone) => zone.id)).toEqual([
      "summary",
      "actions",
      "commitments",
      "explore",
    ]);
    expect(zones[2].blocks.map((block) => block.id)).toEqual([
      "income-allocation",
      "category-breakdown",
      "savings-goal",
      "future-commitments",
      "purchase-simulator",
      "open-expenses",
    ]);
    expect(zones[3].blocks.map((block) => block.id)).toEqual(["month-review"]);
  });

  it("omite uma zona quando todos os seus blocos estão em error", () => {
    const blocks: DashboardBlock[] = ALL_DASHBOARD_BLOCKS.map((block) =>
      block.id === "family-help" || block.id === "month-review"
        ? { ...block, state: "error" as const }
        : block,
    );

    const { zones, failed } = buildDashboardLayout(blocks);

    expect(failed).toEqual(["family-help", "month-review"]);
    expect(zones.map((zone) => zone.id)).toEqual([
      "summary",
      "actions",
      "commitments",
    ]);
  });

  it("preserva empty e future na zona correta com o estado original", () => {
    const blocks: DashboardBlock[] = ALL_DASHBOARD_BLOCKS.map((block) => {
      if (block.id === "month-spend") return { ...block, state: "empty" as const };
      if (block.id === "month-review") return { ...block, state: "future" as const };
      return block;
    });

    const { zones, failed } = buildDashboardLayout(blocks);

    expect(failed).toEqual([]);
    expect(zones.map((zone) => zone.id)).toEqual([
      "summary",
      "actions",
      "commitments",
      "explore",
    ]);
    expect(zones[0].blocks).toEqual([
      { id: "month-spend", state: "empty" },
      { id: "shopping-list", state: "ok" },
      { id: "spend-advice", state: "ok" },
    ]);
    expect(zones[3].blocks).toEqual([
      { id: "family-help", state: "ok" },
      { id: "month-review", state: "future" },
    ]);
  });

  it("impõe a ordem canônica com entrada embaralhada, deduplica e ignora desconhecidos", () => {
    const shuffled: DashboardBlock[] = [
      { id: "month-review", state: "ok" },
      { id: "quick-expense", state: "ok" },
      { id: "category-breakdown", state: "ok" },
      { id: "savings-goal", state: "ok" },
      { id: "month-spend", state: "ok" },
      { id: "daily-consumption", state: "ok" },
      { id: "shopping-list", state: "ok" },
      { id: "spend-advice", state: "ok" },
      { id: "daily-allowance", state: "ok" },
      { id: "card-adjustment", state: "ok" },
      { id: "income-allocation", state: "ok" },
      { id: "future-commitments", state: "ok" },
      { id: "purchase-simulator", state: "ok" },
      { id: "open-expenses", state: "ok" },
      { id: "family-help", state: "ok" },
      { id: "month-spend", state: "error" },
      { id: "unknown-block" as DashboardBlockId, state: "ok" },
    ];

    const { zones, failed } = buildDashboardLayout(shuffled);

    expect(failed).toEqual([]);
    expect(zones.map((zone) => zone.id)).toEqual([
      "summary",
      "actions",
      "commitments",
      "explore",
    ]);
    expect(zones[0].blocks.map((block) => block.id)).toEqual([
      "month-spend",
      "shopping-list",
      "spend-advice",
    ]);
    expect(zones[1].blocks.map((block) => block.id)).toEqual([
      "quick-expense",
      "daily-allowance",
      "card-adjustment",
    ]);
    expect(zones[2].blocks.map((block) => block.id)).toEqual([
      "income-allocation",
      "daily-consumption",
      "category-breakdown",
      "savings-goal",
      "future-commitments",
      "purchase-simulator",
      "open-expenses",
    ]);
    expect(zones[3].blocks.map((block) => block.id)).toEqual([
      "family-help",
      "month-review",
    ]);
  });

  it("mantém a primeira ocorrência na deduplicação de ids", () => {
    const blocks: DashboardBlock[] = [
      { id: "month-spend", state: "error" },
      { id: "month-spend", state: "ok" },
      { id: "spend-advice", state: "ok" },
    ];

    const { zones, failed } = buildDashboardLayout(blocks);

    expect(failed).toEqual(["month-spend"]);
    expect(zones).toHaveLength(1);
    expect(zones[0].blocks).toEqual([{ id: "spend-advice", state: "ok" }]);
  });

  it("retorna zonas e failed vazios para uma lista sem blocos conhecidos", () => {
    const { zones, failed } = buildDashboardLayout([
      { id: "unknown-block" as DashboardBlockId, state: "ok" },
    ]);

    expect(zones).toEqual([]);
    expect(failed).toEqual([]);
  });

  it("inclui future-commitments na zona commitments após category-breakdown", () => {
    const { zones, failed } = buildDashboardLayout([
      { id: "future-commitments", state: "ok" },
    ]);

    expect(failed).toEqual([]);
    expect(zones).toHaveLength(1);
    expect(zones[0].id).toBe("commitments");
    expect(zones[0].blocks.map((block) => block.id)).toEqual([
      "future-commitments",
    ]);

    const withCategory = buildDashboardLayout([
      { id: "category-breakdown", state: "ok" },
      { id: "future-commitments", state: "ok" },
    ]);
    expect(withCategory.zones[0].blocks.map((block) => block.id)).toEqual([
      "category-breakdown",
      "future-commitments",
    ]);
  });

  it("inclui savings-goal na zona commitments após category-breakdown", () => {
    const { zones, failed } = buildDashboardLayout([
      { id: "savings-goal", state: "ok" },
    ]);

    expect(failed).toEqual([]);
    expect(zones).toHaveLength(1);
    expect(zones[0].id).toBe("commitments");
    expect(zones[0].blocks.map((block) => block.id)).toEqual(["savings-goal"]);

    const withCategory = buildDashboardLayout([
      { id: "category-breakdown", state: "ok" },
      { id: "savings-goal", state: "ok" },
    ]);
    expect(withCategory.zones[0].blocks.map((block) => block.id)).toEqual([
      "category-breakdown",
      "savings-goal",
    ]);
  });

  it("move savings-goal para failed quando o estado é error", () => {
    const { zones, failed } = buildDashboardLayout([
      { id: "income-allocation", state: "ok" },
      { id: "savings-goal", state: "error" },
    ]);

    expect(failed).toEqual(["savings-goal"]);
    expect(zones).toHaveLength(1);
    expect(zones[0].blocks.map((block) => block.id)).toEqual([
      "income-allocation",
    ]);
  });

  it("move future-commitments para failed quando o estado é error", () => {
    const { zones, failed } = buildDashboardLayout([
      { id: "income-allocation", state: "ok" },
      { id: "future-commitments", state: "error" },
    ]);

    expect(failed).toEqual(["future-commitments"]);
    expect(zones).toHaveLength(1);
    expect(zones[0].blocks.map((block) => block.id)).toEqual([
      "income-allocation",
    ]);
  });
});

describe("página do dashboard em zonas de decisão", () => {
  const DASHBOARD_COMPONENTS = [
    "MonthSpendCard",
    "ShoppingListCard",
    "SpendAdviceCard",
    "QuickExpenseCard",
    "DailyAllowanceCard",
    "QuickCardAdjustmentCard",
    "IncomeAllocationCard",
    "DailyConsumptionChart",
    "CategoryBreakdownCard",
    "SavingsGoalCard",
    "FutureCommitmentsCard",
    "PurchaseSimulator",
    "OpenExpensesCard",
    "FamilyHelpCard",
    "MonthReviewPanel",
  ];

  it("renderiza cada um dos 15 blocos exatamente uma vez na fonte", () => {
    const page = readSource(DASHBOARD_PAGE);

    for (const component of DASHBOARD_COMPONENTS) {
      expect(page.match(new RegExp(`<${component}[\\s/>]`, "g"))).toHaveLength(
        1,
      );
    }
  });

  it("carrega a lista ativa e isola falhas no bloco shopping-list", () => {
    const page = readSource(DASHBOARD_PAGE);

    expect(page).toContain("loadActiveShoppingItems");
    expect(page).toContain("buildShoppingPlan");
    expect(page).toContain("shoppingLoadFailed = true");
    expect(page).toContain(
      '{ id: "shopping-list" as const, state: "ok" as const }',
    );
    expect(page).toContain(
      '{ id: "shopping-list" as const, state: "error" as const }',
    );
    // Sem itens ativos o bloco não entra no layout e nada é renderizado.
    expect(page).toContain("{shoppingPlan !== null ? (");
  });

  it("inclui o bloco A pagar na zona de Compromissos", () => {
    const page = readSource(DASHBOARD_PAGE);

    const commitmentsIndex = page.indexOf('case "commitments":');
    const openIndex = page.indexOf("<OpenExpensesCard");
    const exploreIndex = page.indexOf('case "explore":');

    expect(commitmentsIndex).toBeGreaterThanOrEqual(0);
    expect(openIndex).toBeGreaterThan(commitmentsIndex);
    expect(openIndex).toBeLessThan(exploreIndex);
    expect(page).toContain('{ id: "open-expenses", state: "ok" }');
    expect(page).toContain("loadOpenCycleExpenses");
  });

  it("mantém savings-goal fora das zonas quando não há meta/progresso", () => {
    const page = readSource(DASHBOARD_PAGE);

    expect(page).toContain(
      '{ id: "savings-goal", state: savingsGoal !== null ? "ok" : "error" }',
    );
    expect(page).toContain("{savingsGoal !== null && (");
  });

  it("monta as zonas com buildDashboardLayout e as entrega ao DashboardZones", () => {
    const page = readSource(DASHBOARD_PAGE);

    expect(page).toContain("buildDashboardLayout");
    expect(page).toContain("<DashboardZones");
    expect(page).toContain("zones={zones}");

    const okIndex = page.indexOf('view.state === "ok" && series !== null');
    const zonesIndex = page.indexOf("<DashboardZones");
    expect(okIndex).toBeGreaterThanOrEqual(0);
    expect(zonesIndex).toBeGreaterThan(okIndex);
  });

  it("define os quatro títulos de zona na ordem canônica", () => {
    const page = readSource(DASHBOARD_PAGE);
    expect(page).toContain('from "@/lib/dashboard-layout"');

    const layoutModule = readSource("../lib/dashboard-layout.ts");
    const titles = ["Resumo do ciclo", "Ações", "Compromissos", "Explorar"];

    let previous = -1;
    for (const title of titles) {
      const index = layoutModule.indexOf(`title: "${title}"`);
      expect(index).toBeGreaterThan(previous);
      previous = index;
    }
  });
});

describe("ajuste rápido do cartão no dashboard", () => {
  it("mantém o bloco de ajuste na zona Ações junto do simulador em Compromissos", () => {
    const page = readSource(DASHBOARD_PAGE);

    expect(page).toContain("<QuickCardAdjustmentCard");
    expect(page).toContain('id: "card-adjustment"');
    expect(page).toContain('id: "purchase-simulator"');

    // #374 preservada: o ajuste rápido fica só em Ações.
    const actionsIndex = page.indexOf('case "actions":');
    const commitmentsIndex = page.indexOf('case "commitments":');
    const adjustmentIndex = page.indexOf("<QuickCardAdjustmentCard");
    const simulatorIndex = page.indexOf("<PurchaseSimulator");
    expect(adjustmentIndex).toBeGreaterThan(actionsIndex);
    expect(adjustmentIndex).toBeLessThan(commitmentsIndex);
    // O simulador volta à superfície em Compromissos, abaixo de Parcelas futuras.
    expect(simulatorIndex).toBeGreaterThan(commitmentsIndex);
    expect(simulatorIndex).toBeGreaterThan(page.indexOf("<FutureCommitmentsCard"));
    expect(simulatorIndex).toBeLessThan(page.indexOf("<OpenExpensesCard"));

    const { zones } = buildDashboardLayout([
      { id: "card-adjustment", state: "ok" },
      { id: "purchase-simulator", state: "ok" },
    ]);
    expect(zones).toEqual([
      {
        id: "actions",
        title: "Ações",
        priority: 2,
        blocks: [{ id: "card-adjustment", state: "ok" }],
      },
      {
        id: "commitments",
        title: "Compromissos",
        priority: 3,
        blocks: [{ id: "purchase-simulator", state: "ok" }],
      },
    ]);
  });

  it("renderiza o simulador só no ciclo corrente com a diária disponível", () => {
    const page = readSource(DASHBOARD_PAGE);

    const commitmentsIndex = page.indexOf('case "commitments":');
    const simulatorIndex = page.indexOf("<PurchaseSimulator");
    expect(simulatorIndex).toBeGreaterThan(commitmentsIndex);

    // Condição de exibição: ciclo corrente + diária + série.
    const start = page.lastIndexOf("{isCurrentCycle", simulatorIndex);
    const condition = page.slice(start, simulatorIndex);
    expect(condition).toContain("isCurrentCycle");
    expect(condition).toContain("allowance !== null");
    expect(condition).toContain("series !== null");

    // Props ligadas ao orçamento, ritmo recente e meta.
    const block = page.slice(simulatorIndex, page.indexOf("/>", simulatorIndex));
    for (const prop of [
      "freeBudgetCents={allowance.freeBudgetCents}",
      "dailyCents={allowance.dailyCents}",
      "remainingDays={allowance.remainingDays}",
      "usualDailySpendCents={usualDailySpend}",
      "savingsGoalCents={savingsGoalCents}",
      "savingsGoalSavedCents={",
    ]) {
      expect(block).toContain(prop);
    }
    expect(block).toContain("savingsGoal?.savedCents ?? 0");
  });

  it("carrega os cartões só no ciclo corrente", () => {
    const page = readSource(DASHBOARD_PAGE);

    expect(page).toMatch(
      /if \(isCurrentCycle\) \{\s*cardAdjustmentData = await loadCardAdjustmentData\(/,
    );
    expect(page).toContain("invoiceMonthKeyForCycle(referenceMonthKey, cycleStartDay)");
  });

  it("renderiza o diagnóstico do período na zona Explorar, antes da ajuda à família", () => {
    const page = readSource(DASHBOARD_PAGE);

    const exploreIndex = page.indexOf('case "explore":');
    const diagnosisIndex = page.indexOf("<PeriodDiagnosisCard");
    const familyIndex = page.indexOf("<FamilyHelpCard");

    expect(exploreIndex).toBeGreaterThanOrEqual(0);
    expect(diagnosisIndex).toBeGreaterThan(exploreIndex);
    expect(familyIndex).toBeGreaterThan(diagnosisIndex);
    expect(page).toContain("loadPeriodAnalysis");
    expect(page).toContain("periodAnalysisView");
    expect(page).toContain("periodAnalysis !== null");
  });
});
