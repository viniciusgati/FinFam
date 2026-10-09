/** Texto do diálogo nativo de confirmação de exclusão de um lançamento. */
export function deleteConfirmMessage(description: string): string {
  const name = description.trim();
  if (!name) return "Excluir este item? Esta ação não pode ser desfeita.";
  return `Excluir "${name}"? Esta ação não pode ser desfeita.`;
}
