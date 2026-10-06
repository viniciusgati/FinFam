import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function EntradasPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-slate-900 p-8 text-center text-white">
      <header className="space-y-1">
        <p className="text-sm font-medium uppercase tracking-widest opacity-80">
          FinFam
        </p>
        <h1 className="text-3xl font-bold">Cadastrar entradas</h1>
      </header>

      <p className="max-w-xl text-lg text-slate-300">
        O cadastro de entradas estará disponível em breve.
      </p>

      <Link
        href="/"
        className="rounded-full bg-white/10 px-6 py-3 text-sm font-medium transition hover:bg-white/20"
      >
        Voltar ao dashboard
      </Link>
    </main>
  );
}
