import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

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

describe("layout do dashboard", () => {
  it("usa largura total, sem max-w nem mx-auto no container", () => {
    const page = readSource("../app/(app)/page.tsx");

    expect(page).toContain('className="flex w-full flex-col gap-6"');
    expect(page).not.toMatch(/max-w-4xl/);
    expect(page).not.toMatch(/mx-auto flex w-full/);
  });

  it("deixa o card principal em largura total, fora do grid", () => {
    const page = readSource("../app/(app)/page.tsx");

    // O hero não usa mais o span de grid do layout antigo.
    expect(page).not.toContain('className={isCalendarMonth ? "" : "md:col-span-2"}');

    const month = page.indexOf("<MonthSpendCard");
    const gridStart = page.indexOf("grid items-stretch gap-6 md:grid-cols-2");
    expect(month).toBeGreaterThanOrEqual(0);
    expect(gridStart).toBeGreaterThan(month);
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
    expect(page).toContain("{isCalendarMonth && (");
  });
});

describe("mensagem acionável no MonthSpendCard", () => {
  it("expõe a prop e a renderiza com role=status e aria-live", () => {
    const card = readSource("../components/MonthSpendCard.tsx");

    expect(card).toContain("actionableMessage");
    expect(card).toContain('role="status"');
    expect(card).toContain('aria-live="polite"');
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
    const loading = readSource("../app/(app)/loading.tsx");

    expect(loading).toContain('aria-busy="true"');
    expect(loading).toContain('role="status"');
    expect(loading).toContain('aria-live="polite"');
    expect(loading).toContain("Carregando…");
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
    const futureIndex = page.indexOf('view.state === "future"');
    const errorBlock = page.slice(errorIndex, futureIndex);

    expect(errorIndex).toBeGreaterThanOrEqual(0);
    expect(futureIndex).toBeGreaterThan(errorIndex);
    expect(errorBlock).not.toContain("CategoryBreakdownCard");
    expect(errorBlock).toContain("<RetryButton");
  });

  it("o loading.tsx tem skeleton Gastos por categoria acessível", () => {
    const loading = readSource("../app/(app)/loading.tsx");

    expect(loading).toContain("Gastos por categoria");
    expect(loading).toContain('aria-busy="true"');
    expect(loading).toContain('role="status"');
  });
});

const DASHBOARD_PAGE = "../app/(app)/page.tsx";
const HISTORY_PAGE = "../app/(app)/historico/page.tsx";
const HISTORY_VIEW = "../components/HistoryView.tsx";

describe("estados de navegação e onboarding do ciclo", () => {
  it("renderiza FutureMonthNotice sob o estado future nas duas telas", () => {
    const dashboard = readSource(DASHBOARD_PAGE);
    expect(dashboard).toContain('view.state === "future"');
    expect(dashboard).toContain("<FutureMonthNotice />");
    expect(dashboard).toContain("isFutureMonth");

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
