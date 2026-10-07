"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

type LoginError = { message: string; kind: "credential" | "config" };

export default function LoginPage() {
  const router = useRouter();
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [error, setError] = useState<LoginError | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user, pass }),
      });

      if (response.ok) {
        router.push("/");
        router.refresh();
        return;
      }

      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        code?: string;
      };

      if (data.code === "CONFIG_ERROR") {
        setError({
          message:
            data.error ??
            "Serviço indisponível: falta configurar o FinFam. Avise quem administra o FinFam.",
          kind: "config",
        });
        return;
      }

      setError({
        message: data.error ?? "Não foi possível entrar.",
        kind: "credential",
      });
    } catch {
      setError({
        message: "Erro de conexão. Tente novamente.",
        kind: "credential",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas p-6">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-5 rounded-2xl border border-border bg-surface p-8 shadow-xl"
      >
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-bold text-foreground">FinFam</h1>
          <p className="text-sm text-subtle">Acesso da família</p>
        </div>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-foreground-muted">
            Usuário
          </span>
          <input
            type="text"
            value={user}
            onChange={(event) => setUser(event.target.value)}
            autoComplete="username"
            required
            className="w-full rounded-lg border border-border-strong bg-surface-raised px-3 py-2 text-foreground outline-none focus:border-emerald-500"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-foreground-muted">Senha</span>
          <input
            type="password"
            value={pass}
            onChange={(event) => setPass(event.target.value)}
            autoComplete="current-password"
            required
            className="w-full rounded-lg border border-border-strong bg-surface-raised px-3 py-2 text-foreground outline-none focus:border-emerald-500"
          />
        </label>

        {error &&
          (error.kind === "config" ? (
            <div
              role="alert"
              aria-live="polite"
              className="flex items-start gap-2 rounded-lg border border-amber-700 bg-amber-950 px-3 py-2 text-sm text-amber-200"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="mt-0.5 h-4 w-4 flex-shrink-0"
              >
                <path
                  fillRule="evenodd"
                  d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495ZM10 5a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 5Zm0 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
                  clipRule="evenodd"
                />
              </svg>
              <span>{error.message}</span>
            </div>
          ) : (
            <p
              role="alert"
              aria-live="polite"
              className="rounded-lg bg-red-950 px-3 py-2 text-sm text-red-200"
            >
              {error.message}
            </p>
          ))}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white transition hover:bg-emerald-700 disabled:opacity-60"
        >
          {loading ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </main>
  );
}
