import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import ConsumptionModeToggle, {
  CONSUMPTION_MODE_GROUP_LABEL,
  CONSUMPTION_MODE_SAVED_MESSAGE,
  CONSUMPTION_MODE_SAVE_ERROR,
  CONSUMPTION_MODE_SAVING_LABEL,
  consumptionModePayload,
} from "./ConsumptionModeToggle";
import type { ConsumptionMode } from "@/lib/consumption-mode";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

function render(initialMode: ConsumptionMode, cycleStartDay = 10): string {
  return renderToStaticMarkup(
    createElement(ConsumptionModeToggle, { initialMode, cycleStartDay }),
  );
}

function readSource(): string {
  return readFileSync(
    fileURLToPath(new URL("./ConsumptionModeToggle.tsx", import.meta.url)),
    "utf8",
  );
}

function pressedButton(html: string, label: string, pressed: "true" | "false") {
  return new RegExp(
    `<button[^>]*type="button"[^>]*aria-pressed="${pressed}"[^>]*>${label}</button>`,
  ).test(html);
}

describe("ConsumptionModeToggle (markup estático)", () => {
  it("expõe o grupo acessível e os dois modos com Renda selecionada por padrão", () => {
    const html = render("INCOME");

    expect(html).toContain('role="group"');
    expect(html).toContain(`aria-label="${CONSUMPTION_MODE_GROUP_LABEL}"`);
    expect(html).toContain("Renda do ciclo");
    expect(html).toContain("Orçamento variável");
    expect(pressedButton(html, "Renda do ciclo", "true")).toBe(true);
    expect(pressedButton(html, "Orçamento variável", "false")).toBe(true);
  });

  it("reflete o modo VARIABLE_BUDGET inicial", () => {
    const html = render("VARIABLE_BUDGET");

    expect(pressedButton(html, "Renda do ciclo", "false")).toBe(true);
    expect(pressedButton(html, "Orçamento variável", "true")).toBe(true);
    expect(html).not.toContain(CONSUMPTION_MODE_SAVING_LABEL);
    expect(html).not.toContain(CONSUMPTION_MODE_SAVED_MESSAGE);
    expect(html).not.toContain(CONSUMPTION_MODE_SAVE_ERROR);
  });
});

describe("ConsumptionModeToggle (envio e feedback)", () => {
  it("envia exatamente { cycleStartDay, consumptionMode } no clique", () => {
    expect(consumptionModePayload(10, "VARIABLE_BUDGET")).toEqual({
      cycleStartDay: 10,
      consumptionMode: "VARIABLE_BUDGET",
    });
    expect(consumptionModePayload(1, "INCOME")).toEqual({
      cycleStartDay: 1,
      consumptionMode: "INCOME",
    });

    const source = readSource();
    expect(source).toContain('fetch("/api/settings"');
    expect(source).toContain('method: "PUT"');
    expect(source).toContain(
      "JSON.stringify(consumptionModePayload(cycleStartDay, nextMode))",
    );
  });

  it("durante o envio desabilita os dois botões e marca o escolhido com Salvando… e aria-busy", () => {
    const source = readSource();

    expect(source).toContain("setSavingMode(nextMode)");
    expect(source).toContain("disabled={savingMode !== null}");
    expect(source).toContain("aria-busy={savingThis ? true : undefined}");
    expect(source).toContain(
      "{savingThis ? CONSUMPTION_MODE_SAVING_LABEL : option.label}",
    );
    expect(CONSUMPTION_MODE_SAVING_LABEL).toBe("Salvando…");
  });

  it("no sucesso atualiza o modo, mostra o status acima dos botões e recarrega a Home", () => {
    const source = readSource();
    const statusIndex = source.indexOf("{success && (");
    const groupIndex = source.indexOf('role="group"');

    expect(statusIndex).toBeGreaterThanOrEqual(0);
    expect(statusIndex).toBeLessThan(groupIndex);
    expect(source).toContain("setMode(nextMode)");
    expect(source).toContain("setSuccess(true)");
    expect(source).toContain("router.refresh()");
    expect(source).toContain('role="status"');
    expect(CONSUMPTION_MODE_SAVED_MESSAGE).toBe("Modo de consumo atualizado");
  });

  it("em 400 ou falha de rede mantém o modo anterior e mostra o alerta acima dos botões", () => {
    const source = readSource();
    const alertIndex = source.indexOf("{error && (");
    const groupIndex = source.indexOf('role="group"');
    const setModeIndex = source.indexOf("setMode(nextMode)");
    const errorGuardIndex = source.indexOf("if (!response.ok)");

    expect(alertIndex).toBeGreaterThanOrEqual(0);
    expect(alertIndex).toBeLessThan(groupIndex);
    expect(errorGuardIndex).toBeGreaterThanOrEqual(0);
    // O modo só muda depois da resposta OK; a falha sai antes via return.
    expect(setModeIndex).toBeGreaterThan(errorGuardIndex);
    expect((source.match(/setMode\(nextMode\)/g) ?? []).length).toBe(1);
    expect((source.match(/setError\(CONSUMPTION_MODE_SAVE_ERROR\)/g) ?? []).length)
      .toBe(2);
    expect(source).toContain('role="alert"');
    expect(source).toContain("setSavingMode(null)");
    expect(CONSUMPTION_MODE_SAVE_ERROR).toBe(
      "Não foi possível salvar o modo de consumo. Tente novamente.",
    );
  });

  it("não emite console.error no fluxo feliz", () => {
    expect(readSource()).not.toContain("console.error");
  });
});
