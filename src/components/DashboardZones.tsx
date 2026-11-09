import type { ReactNode } from "react";
import type { DashboardZone } from "@/lib/dashboard-layout";

export interface DashboardZonesProps {
  /** Zonas já ordenadas por `buildDashboardLayout`. */
  zones: readonly DashboardZone[];
  /** Conteúdo de cada zona, decidido pela página a partir de `zone.blocks`. */
  renderZone: (zone: DashboardZone) => ReactNode;
}

/**
 * Apresentação das zonas de decisão do dashboard (história #361). Recebe as
 * zonas na ordem canônica e renderiza cada uma como uma seção com `<h2>` do
 * título. O conteúdo interno é responsabilidade do chamador: assim a página
 * mantém as condicionais de exibição dos blocos e este componente fica livre
 * de dados, relógio e DOM.
 */
export default function DashboardZones({
  zones,
  renderZone,
}: DashboardZonesProps) {
  return (
    <>
      {zones.map((zone) => (
        <section
          key={zone.id}
          data-zone={zone.id}
          aria-labelledby={`dashboard-zone-${zone.id}`}
          className="flex flex-col gap-4"
        >
          <h2
            id={`dashboard-zone-${zone.id}`}
            className="text-sm font-medium uppercase tracking-widest text-subtle"
          >
            {zone.title}
          </h2>
          {renderZone(zone)}
        </section>
      ))}
    </>
  );
}
