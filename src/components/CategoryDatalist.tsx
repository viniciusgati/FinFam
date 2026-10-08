import { NO_CATEGORY_LABEL } from "@/lib/categories";

/** Id compartilhado entre o `<input list>` e o `<datalist>` de categoria. */
export const CATEGORY_DATALIST_ID = "category-suggestions";

interface CategoryDatalistProps {
  suggestions: string[];
  id?: string;
}

/**
 * Datalist de categorias: as sugestões já utilizadas na família e, sempre, a
 * opção de valor vazio rotulada "Sem categoria" (inclusive quando não há
 * sugestões). Selecioná-la limpa o campo.
 */
export default function CategoryDatalist({
  suggestions,
  id = CATEGORY_DATALIST_ID,
}: CategoryDatalistProps) {
  return (
    <datalist id={id}>
      <option value="">{NO_CATEGORY_LABEL}</option>
      {suggestions.map((suggestion) => (
        <option key={suggestion} value={suggestion} />
      ))}
    </datalist>
  );
}
