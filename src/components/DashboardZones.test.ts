import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { DashboardZone } from "@/lib/dashboard-layout";
import DashboardZones from "./DashboardZones";

const zones: DashboardZone[] = [
  {
    id: "summary",
    title: "Resumo do ciclo",
    priority: 1,
    blocks: [{ id: "month-spend", state: "ok" }],
  },
  {
    id: "actions",
    title: "Ações",
    priority: 2,
    blocks: [{ id: "quick-expense", state: "ok" }],
  },
  {
    id: "commitments",
    title: "Compromissos",
    priority: 3,
    blocks: [{ id: "income-allocation", state: "ok" }],
  },
  {
    id: "explore",
    title: "Explorar",
    priority: 4,
    blocks: [{ id: "family-help", state: "ok" }],
  },
];

function render(): string {
  return renderToStaticMarkup(
    createElement(DashboardZones, {
      zones,
      renderZone: (zone) =>
        createElement(
          "div",
          { "data-marker": zone.id },
          `marcador-${zone.id}`,
        ),
    }),
  );
}

describe("DashboardZones (renderização)", () => {
  it("renderiza as quatro zonas como seções com h2 na ordem canônica", () => {
    const html = render();

    expect(html.match(/<section/g)).toHaveLength(4);
    expect(html.match(/<h2/g)).toHaveLength(4);

    const summary = html.indexOf("Resumo do ciclo");
    const actions = html.indexOf("Ações");
    const commitments = html.indexOf("Compromissos");
    const explore = html.indexOf("Explorar");

    expect(summary).toBeGreaterThanOrEqual(0);
    expect(actions).toBeGreaterThan(summary);
    expect(commitments).toBeGreaterThan(actions);
    expect(explore).toBeGreaterThan(commitments);
  });

  it("coloca o conteúdo de resumo e ações antes de compromissos e explorar", () => {
    const html = render();

    const summaryMarker = html.indexOf("marcador-summary");
    const actionsMarker = html.indexOf("marcador-actions");
    const commitmentsMarker = html.indexOf("marcador-commitments");
    const exploreMarker = html.indexOf("marcador-explore");

    expect(summaryMarker).toBeGreaterThanOrEqual(0);
    expect(actionsMarker).toBeGreaterThan(summaryMarker);
    expect(commitmentsMarker).toBeGreaterThan(actionsMarker);
    expect(exploreMarker).toBeGreaterThan(commitmentsMarker);
  });

  it("associa cada seção ao seu título via aria-labelledby", () => {
    const html = render();

    expect(html).toContain('aria-labelledby="dashboard-zone-summary"');
    expect(html).toContain('id="dashboard-zone-summary"');
    expect(html).toContain('data-zone="explore"');
  });

  it("não renderiza zonas ausentes da lista", () => {
    const html = renderToStaticMarkup(
      createElement(DashboardZones, {
        zones: zones.slice(0, 1),
        renderZone: (zone) => createElement("p", null, zone.title),
      }),
    );

    expect(html).toContain("Resumo do ciclo");
    expect(html).not.toContain("Ações");
    expect(html).not.toContain("Compromissos");
    expect(html).not.toContain("Explorar");
  });
});
