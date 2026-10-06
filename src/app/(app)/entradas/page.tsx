import type { Metadata } from "next";
import PlaceholderPage from "@/components/PlaceholderPage";

export const metadata: Metadata = { title: "Cadastrar entradas — FinFam" };

export default function EntradasPage() {
  return (
    <PlaceholderPage
      title="Cadastrar entradas"
      message="O cadastro de entradas estará disponível em breve."
    />
  );
}
