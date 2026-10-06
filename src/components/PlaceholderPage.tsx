import Link from "next/link";

interface PlaceholderPageProps {
  title: string;
}

export default function PlaceholderPage({ title }: PlaceholderPageProps) {
  return (
    <section className="mx-auto flex max-w-xl flex-col items-center gap-4 rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
      <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
      <p className="text-slate-600">
        O cadastro desta seção chega em breve. Estamos preparando tudo para você.
      </p>
      <Link
        href="/"
        className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
      >
        Ir para o Dashboard
      </Link>
    </section>
  );
}
