import type { ReactElement, SVGProps } from "react";
import type { NavIconName } from "@/lib/navigation";

/**
 * Ícones do menu lateral em SVG inline 24×24 com `stroke="currentColor"`.
 * O projeto não possui nenhuma biblioteca de ícones; estes desenhos próprios
 * seguem o mesmo padrão visual (traço uniforme, pontas arredondadas).
 */
function Icon({
  children,
  ...rest
}: Omit<SVGProps<SVGSVGElement>, "width" | "height" | "viewBox">) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const NAV_ICONS: Record<NavIconName, ReactElement> = {
  dashboard: (
    <Icon>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
      <path d="M10 21v-6h4v6" />
    </Icon>
  ),
  entradas: (
    <Icon>
      <path d="M12 3v12" />
      <path d="m7 10 5 5 5-5" />
      <path d="M4 21h16" />
    </Icon>
  ),
  saidas: (
    <Icon>
      <path d="M12 21V9" />
      <path d="m7 14 5-5 5 5" />
      <path d="M4 3h16" />
    </Icon>
  ),
  gastos: (
    <Icon>
      <path d="M6 3h12v18l-3-2-3 2-3-2-3 2Z" />
      <path d="M9 8h6" />
      <path d="M9 12h6" />
    </Icon>
  ),
  cartoes: (
    <Icon>
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M2 10h20" />
    </Icon>
  ),
  historico: (
    <Icon>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </Icon>
  ),
  configuracoes: (
    <Icon>
      <path d="M4 21v-7" />
      <path d="M4 10V3" />
      <path d="M12 21v-9" />
      <path d="M12 8V3" />
      <path d="M20 21v-5" />
      <path d="M20 12V3" />
      <path d="M1 14h6" />
      <path d="M9 8h6" />
      <path d="M17 16h6" />
    </Icon>
  ),
};

/** Ícone do botão "Fixar menu" (pushpin), mesmo padrão dos ícones do menu. */
export function PinIcon(props: Omit<SVGProps<SVGSVGElement>, "width" | "height" | "viewBox">) {
  return (
    <Icon {...props}>
      <path d="M7 4h10" />
      <path d="M9 4v6l-1.5 4h9L15 10V4" />
      <path d="M12 14v7" />
    </Icon>
  );
}
