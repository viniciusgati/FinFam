import type { Metadata } from "next";
import { GLOSSARY, glossaryHref } from "@/lib/glossary";

export const metadata: Metadata = { title: "Ajuda — FinFam" };

export default function AjudaPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold text-foreground">Ajuda</h1>
        <p className="text-foreground-muted">
          Glossário dos conceitos usados no FinFam. Toque em um termo para ver
          a definição e um exemplo.
        </p>
      </header>

      <nav aria-label="Índice do glossário">
        <ul className="flex flex-wrap gap-2">
          {GLOSSARY.map((term) => (
            <li key={term.id}>
              <a
                href={"#" + term.id}
                className="inline-flex rounded-full border border-border bg-surface px-3 py-1 text-sm text-foreground-muted underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                {term.term}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="flex flex-col gap-8">
        {GLOSSARY.map((term) => (
          <section
            key={term.id}
            id={term.id}
            aria-labelledby={`${term.id}-titulo`}
            className="scroll-mt-24 space-y-2"
          >
            <h2
              id={`${term.id}-titulo`}
              className="text-lg font-semibold text-foreground"
            >
              {term.term}
            </h2>
            <p className="text-foreground-muted">{term.definition}</p>
            <p className="text-sm text-foreground-muted">
              <span className="font-medium text-foreground">Exemplo: </span>
              {term.example}
            </p>
            <a
              href={glossaryHref(term.id)}
              className="inline-block text-sm text-foreground-muted underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              Link direto para este termo
            </a>
          </section>
        ))}
      </div>
    </div>
  );
}
