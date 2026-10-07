export type NavIconName =
  | "dashboard"
  | "entradas"
  | "saidas"
  | "gastos"
  | "cartoes"
  | "historico"
  | "configuracoes";

export interface NavItem {
  href: string;
  label: string;
  icon: NavIconName;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Dashboard", icon: "dashboard" },
  { href: "/entradas", label: "Entradas", icon: "entradas" },
  { href: "/saidas", label: "Saídas", icon: "saidas" },
  { href: "/gastos", label: "Gastos", icon: "gastos" },
  { href: "/cartoes", label: "Cartões", icon: "cartoes" },
  { href: "/historico", label: "Histórico", icon: "historico" },
  { href: "/configuracoes", label: "Configurações", icon: "configuracoes" },
];

/**
 * Indica se `href` é a rota ativa para o `pathname` atual.
 *
 * A rota raiz (`/`) exige correspondência exata; as demais casam também com
 * subrotas (ex.: `/entradas/123` mantém "Entradas" ativo).
 */
export function isActivePath(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
