export interface NavItem {
  href: string;
  label: string;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Dashboard" },
  { href: "/entradas", label: "Entradas" },
  { href: "/saidas", label: "Saídas" },
  { href: "/gastos", label: "Gastos" },
  { href: "/cartoes", label: "Cartões" },
  { href: "/historico", label: "Histórico" },
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
