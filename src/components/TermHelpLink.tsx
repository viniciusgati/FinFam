import Link from "next/link";
import {
  getGlossaryTerm,
  glossaryHref,
  type GlossaryTermId,
} from "@/lib/glossary";

export interface TermHelpLinkProps {
  termId: GlossaryTermId;
  className?: string;
}

/**
 * Link contextual "Saiba mais" para a âncora de um termo do glossário em
 * `/ajuda`. Server-safe (sem hooks): usado nos cards que exibem os conceitos
 * financeiros, sempre apontando para `glossaryHref(termId)`.
 */
export default function TermHelpLink({
  termId,
  className = "",
}: TermHelpLinkProps) {
  const term = getGlossaryTerm(termId);

  return (
    <Link
      href={glossaryHref(termId)}
      aria-label={`Saiba mais sobre ${term.term}`}
      className={`inline-flex items-center rounded text-sm font-medium underline underline-offset-2 opacity-90 transition hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current focus-visible:ring-offset-2 ${className}`.trim()}
    >
      Saiba mais
    </Link>
  );
}
