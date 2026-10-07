import type { Metadata } from "next";
import SettingsForm from "@/components/SettingsForm";
import { defaultSettings, getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Configurações — FinFam" };

export default async function ConfiguracoesPage() {
  let settings = defaultSettings();
  let loadError: string | null = null;

  try {
    settings = await getSettings();
  } catch {
    loadError = "Não foi possível carregar a configuração. Tente novamente.";
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold text-foreground">Configurações</h1>
        <p className="text-foreground-muted">
          Defina o dia do mês que marca o início do seu ciclo financeiro.
        </p>
      </header>

      <SettingsForm
        initialCycleStartDay={settings.cycleStartDay}
        initialError={loadError}
      />
    </div>
  );
}
