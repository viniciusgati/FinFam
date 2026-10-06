import Link from "next/link";

const LINKS = [
  { href: "/", label: "Início" },
  { href: "/entradas", label: "Entradas" },
  { href: "/saidas", label: "Saídas" },
] as const;

export default function AppNav({ current }: { current?: string }) {
  return (
    <nav className="flex flex-wrap items-center justify-center gap-2 text-sm">
      {LINKS.map((link) => {
        const active = link.href === current;
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={`rounded-full px-4 py-1.5 font-medium transition ${
              active
                ? "bg-emerald-600 text-white"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
