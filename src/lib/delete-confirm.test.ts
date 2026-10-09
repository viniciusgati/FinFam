import { describe, expect, it } from "vitest";
import { deleteConfirmMessage } from "./delete-confirm";

describe("deleteConfirmMessage", () => {
  it("inclui o nome do item entre aspas", () => {
    expect(deleteConfirmMessage("Mercado")).toBe(
      'Excluir "Mercado"? Esta ação não pode ser desfeita.',
    );
    expect(deleteConfirmMessage("Farmácia")).toBe(
      'Excluir "Farmácia"? Esta ação não pode ser desfeita.',
    );
  });

  it("cai no texto genérico quando a descrição é vazia ou só espaços", () => {
    expect(deleteConfirmMessage("")).toBe(
      "Excluir este item? Esta ação não pode ser desfeita.",
    );
    expect(deleteConfirmMessage("   ")).toBe(
      "Excluir este item? Esta ação não pode ser desfeita.",
    );
  });

  it("ignora espaços nas pontas do nome", () => {
    expect(deleteConfirmMessage("  Mercado  ")).toBe(
      'Excluir "Mercado"? Esta ação não pode ser desfeita.',
    );
  });
});
