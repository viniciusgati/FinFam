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
  it("monta lista, resumo e comparação a partir de funções puras", () => {
    const page = readSource("../app/(app)/historico/page.tsx");

    expect(page).toContain("buildMonthHistory");
    expect(page).toContain("compareWithHistory");
    expect(page).toContain("Ainda não há meses anteriores registrados.");
    expect(page).toContain('role="status"');
    expect(page).toContain('aria-live="polite"');
    expect(page).toContain("formatCents");
  });

  it("exibe o resumo compacto do mês e a lista de evolução", () => {
    const page = readSource("../app/(app)/historico/page.tsx");

    // Resumo compacto usa o rótulo do mês e o nível textual (sem depender de cor).
    expect(page).toContain("monthLabel");
    expect(page).toContain("levelLabel");
    // Lista de meses com seção rotulada.
    expect(page).toContain('aria-label="Evolução dos meses"');
    expect(page).toContain("history.map");
  });

  it("mantém o MonthSelector com isCurrentMonth calculado", () => {
    const page = readSource("../app/(app)/historico/page.tsx");

    expect(page).toContain("<MonthSelector");
    expect(page).toContain("isCurrentMonth={isCurrentMonth}");
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

const PAGES = ["../app/(app)/page.tsx", "../app/(app)/historico/page.tsx"];

describe("estados de navegação e onboarding do ciclo", () => {
  it("renderiza FutureMonthNotice sob o estado future nas duas páginas", () => {
    for (const path of PAGES) {
      const page = readSource(path);

      expect(page).toContain('view.state === "future"');
      expect(page).toContain("<FutureMonthNotice />");
      expect(page).toContain("isFutureMonth");
    }
  });

  it("passa isFutureMonth para dashboardView", () => {
    for (const path of PAGES) {
      const page = readSource(path);

      expect(page).toMatch(/dashboardView\(\{[\s\S]*?isFutureMonth/);
    }
  });

  it("renderiza o vazio por emptyStateCopy(view.reason), sem hardcode de CTA", () => {
    for (const path of PAGES) {
      const page = readSource(path);

      expect(page).toContain("emptyStateCopy(view.reason)");
      expect(page).not.toContain("Cadastrar entradas");
      expect(page).not.toContain('href="/entradas"');
    }
  });
});
