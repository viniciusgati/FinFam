"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

export interface SettingsFormProps {
  initialCycleStartDay: number;
  initialError?: string | null;
}

const FALLBACK_ERROR = "Não foi possível salvar. Tente novamente.";

export default function SettingsForm({
  initialCycleStartDay,
  initialError,
}: SettingsFormProps) {
  const [cycleStartDay, setCycleStartDay] = useState(
    String(initialCycleStartDay),
  );
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(initialError ?? null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  function showSuccess() {
    setSuccess(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setSuccess(false), 3000);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaving(true);

    try {
      const response = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cycleStartDay: Number(cycleStartDay) }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        cycleStartDay?: number;
      };

      if (!response.ok) {
        setError(data.error ?? FALLBACK_ERROR);
        return;
      }

      if (typeof data.cycleStartDay === "number") {
        setCycleStartDay(String(data.cycleStartDay));
      }
      showSuccess();
    } catch {
      setError(FALLBACK_ERROR);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      {success && (
        <div
          role="status"
          className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800"
        >
          Configuração salva com sucesso
        </div>
      )}

      {error && (
        <p
          role="alert"
          className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {error}
        </p>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block space-y-1">
          <span className="text-sm font-medium text-slate-700">
            Dia de início do ciclo financeiro
          </span>
          <input
            type="number"
            min={1}
            max={28}
            value={cycleStartDay}
            onChange={(event) => setCycleStartDay(event.target.value)}
            disabled={saving}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-emerald-500 disabled:bg-slate-50 sm:max-w-[10rem]"
          />
          <span className="block text-xs text-slate-500">
            Entre 1 e 28. Use o dia de fechamento do cartão para o ciclo
            refletir o seu mês real.
          </span>
        </label>

        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-emerald-600 px-5 py-2 font-medium text-white transition hover:bg-emerald-700 disabled:opacity-60"
        >
          {saving ? "Salvando…" : "Salvar"}
        </button>
      </form>
    </section>
  );
}
